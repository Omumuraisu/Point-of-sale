import { createClient } from "npm:@supabase/supabase-js@2";

type VerificationPurpose = "activation" | "recovery";
type AccountRow = {
  account_id: number;
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
  password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);

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

  let input: { password?: unknown; purpose?: unknown };
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: { message: "Invalid request" } }, 400);
  }

  const password = typeof input.password === "string" ? input.password : "";
  const purpose = input.purpose === "activation" || input.purpose === "recovery"
    ? input.purpose as VerificationPurpose
    : null;
  if (!purpose || !isStrongPassword(password)) {
    return jsonResponse({
      error: { message: "Use 8 or more characters with uppercase, lowercase, and a number" },
    }, 400);
  }

  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse({ error: { message: "Verification has expired" } }, 401);

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user?.phone_confirmed_at) {
    return jsonResponse({ error: { message: "Verification has expired" } }, 401);
  }
  if (!hasRecentOtpAuthentication(token)) {
    return jsonResponse({ error: { message: "Verify the one-time code before changing your password" } }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: account, error: accountError } = await admin.from("accounts")
    .select("account_id, status, is_verified, user_type")
    .eq("auth_user_id", userData.user.id)
    .in("user_type", ["business_owner", "vendor", "developer"])
    .maybeSingle<AccountRow>();
  const allowedState = purpose === "activation"
    ? account?.status === "pending" && account?.is_verified === false
    : account?.status === "active" && account?.is_verified === true;
  if (accountError || !account || !allowedState || !(await hasEligibleProfile(admin, account))) {
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
