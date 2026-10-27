import { createClient } from "npm:@supabase/supabase-js@2";

type VerificationPurpose = "activation" | "recovery";
type VerificationChannel = "email" | "sms";
type AccountRow = {
  account_id: number;
  email: string | null;
  phone_number: string | null;
  status: string;
  is_verified: boolean;
  user_type: string;
};

type AuthenticationMethod = string | {
  method?: unknown;
  timestamp?: unknown;
};

const MAX_OTP_AGE_SECONDS = 10 * 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isStrongPassword = (password: string): boolean =>
  password.length >= 8 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9\s]/.test(password);

const normalizePhone = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;
  return "";
};

const normalizeEmail = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
};

const decodeJwtClaims = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const claims = JSON.parse(atob(padded));
    return claims && typeof claims === "object" ? claims as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

const hasRecentOtpAuthentication = (token: string): boolean => {
  const claims = decodeJwtClaims(token);
  const methods = Array.isArray(claims?.amr) ? claims.amr as AuthenticationMethod[] : [];
  const issuedAt = typeof claims?.iat === "number" ? claims.iat : null;
  const now = Math.floor(Date.now() / 1000);

  return methods.some((entry) => {
    const method = typeof entry === "string" ? entry : entry?.method;
    if (method !== "otp") return false;

    const rawTimestamp = typeof entry === "object" && typeof entry?.timestamp === "number"
      ? entry.timestamp
      : issuedAt;
    if (rawTimestamp === null) return false;

    const timestamp = rawTimestamp > 1_000_000_000_000 ? Math.floor(rawTimestamp / 1000) : rawTimestamp;
    const ageSeconds = now - timestamp;
    return ageSeconds >= -60 && ageSeconds <= MAX_OTP_AGE_SECONDS;
  });
};

const hasEligibleProfile = async (
  admin: ReturnType<typeof createClient>,
  account: AccountRow,
): Promise<boolean> => {
  if (account.user_type === "developer") return true;
  if (account.user_type === "business_owner") {
    const { data, error } = await admin.from("business_owner")
      .select("business_owner_id")
      .eq("account_id", account.account_id)
      .is("archived_at", null)
      .maybeSingle();
    return !error && Boolean(data);
  }
  if (account.user_type === "vendor") {
    const { data, error } = await admin.from("vendor")
      .select("vendor_id")
      .eq("account_id", account.account_id)
      .eq("is_approved", true)
      .maybeSingle();
    return !error && Boolean(data);
  }
  return false;
};

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: { message: "Method not allowed" } }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: { message: "Password setup is unavailable" } }, 500);
  }

  let input: { password?: unknown; purpose?: unknown; channel?: unknown };
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: { message: "Invalid request" } }, 400);
  }

  const password = typeof input.password === "string" ? input.password : "";
  const purpose = input.purpose === "activation" || input.purpose === "recovery"
    ? input.purpose as VerificationPurpose
    : null;
  const channelProvided = input.channel !== undefined;
  const channel = input.channel === "email" || input.channel === "sms"
    ? input.channel as VerificationChannel
    : null;
  if (!purpose || !isStrongPassword(password) || (channelProvided && !channel)) {
    return jsonResponse({
      error: {
        message: channelProvided && !channel
          ? "Invalid verification channel"
          : "Use 8 or more characters with uppercase, lowercase, a number, and a symbol",
      },
    }, 400);
  }

  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse({ error: { message: "Verification has expired" } }, 401);

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  const verifiedIdentifier = channel === "email"
    ? normalizeEmail(userData.user?.email)
    : channel === "sms"
    ? normalizePhone(userData.user?.phone)
    : "";
  // verifyOtp already proves ownership by issuing a JWT whose AMR contains a
  // recent `otp` entry. Confirmation timestamps are not a reliable second
  // signal here: an OTP session can be valid before GoTrue exposes the matching
  // email_confirmed_at/phone_confirmed_at value on the returned user.
  if (userError || !userData.user || (channel !== null && !verifiedIdentifier)) {
    return jsonResponse({ error: { message: "Verification has expired" } }, 401);
  }
  if (!hasRecentOtpAuthentication(token)) {
    return jsonResponse({ error: { message: "Verify the one-time code before changing your password" } }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: account, error: accountError } = await admin.from("accounts")
    .select("account_id, email, phone_number, status, is_verified, user_type")
    .eq("auth_user_id", userData.user.id)
    .in("user_type", ["business_owner", "vendor", "developer"])
    .maybeSingle<AccountRow>();
  const accountIdentifier = channel === "email"
    ? normalizeEmail(account?.email)
    : channel === "sms"
    ? normalizePhone(account?.phone_number)
    : "";
  const identifierMatches = channel === null || accountIdentifier === verifiedIdentifier;
  const allowedState = purpose === "activation"
    ? account?.status === "pending" && account?.is_verified === false
    : account?.status === "active" && account?.is_verified === true;
  if (accountError || !account || !identifierMatches || !allowedState || !(await hasEligibleProfile(admin, account))) {
    return jsonResponse({ error: { message: "This account cannot complete password setup" } }, 403);
  }

  const { error: passwordError } = await admin.auth.admin.updateUserById(userData.user.id, { password });
  if (passwordError) {
    console.error("[POS_PASSWORD] Auth password update failed.", { code: passwordError.code });
    return jsonResponse({ error: { message: "Unable to save the password" } }, 500);
  }

  if (purpose === "activation") {
    const { error: activationError } = await admin.from("accounts")
      .update({ status: "active", is_verified: true })
      .eq("account_id", account.account_id)
      .eq("auth_user_id", userData.user.id);
    if (activationError) {
      console.error("[POS_PASSWORD] Account activation failed.", { code: activationError.code });
      return jsonResponse({ error: { message: "Password saved; retry account activation" } }, 500);
    }
  }

  console.info("[POS_PASSWORD] Password completion succeeded.", {
    accountId: String(account.account_id),
    purpose,
  });
  return jsonResponse({ completed: true });
});
