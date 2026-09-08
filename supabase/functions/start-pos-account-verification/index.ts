import { createClient } from "npm:@supabase/supabase-js@2";

type VerificationPurpose = "activation" | "recovery";
type AccountRow = {
  account_id: number;
  auth_user_id: string | null;
  phone_number: string | null;
  status: string;
  is_verified: boolean;
  user_type: string;
};
type VerificationClaim = {
  allowed: boolean;
  request_id: string | null;
  retry_after_seconds: number;
  reason: string | null;
};

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

const genericResponse = (resendAfterSeconds = 60): Response =>
  jsonResponse({ accepted: true, resendAfterSeconds });

const normalizePhone = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;
  return "";
};

const maskPhone = (phone: string): string => `***${phone.slice(-4)}`;

const parsePurpose = (value: unknown): VerificationPurpose | null =>
  value === "activation" || value === "recovery" ? value : null;

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
    return jsonResponse({ error: { message: "Verification is unavailable" } }, 500);
  }

  let input: { phone?: unknown; purpose?: unknown };
  try {
    input = await request.json();
  } catch {
    return genericResponse();
  }

  const phone = normalizePhone(input.phone);
  const purpose = parsePurpose(input.purpose);
  if (!phone || !purpose) return genericResponse();

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: candidates, error: accountError } = await admin.from("accounts")
    .select("account_id, auth_user_id, phone_number, status, is_verified, user_type")
    .in("user_type", ["business_owner", "vendor", "developer"])
    .in("status", ["active", "pending"]);
  if (accountError) {
    console.error("[POS_VERIFICATION] Account lookup failed.", { code: accountError.code });
    return jsonResponse({ error: { message: "Verification is unavailable" } }, 500);
  }

  const matches = ((candidates ?? []) as AccountRow[]).filter((row: AccountRow) => normalizePhone(row.phone_number) === phone);
  if (matches.length !== 1) return genericResponse();
  const account = matches[0] as AccountRow;
  if (!(await hasEligibleProfile(admin, account))) return genericResponse();

  const activationComplete = Boolean(account.auth_user_id && account.status === "active" && account.is_verified);
  const eligible = purpose === "activation" ? !activationComplete : activationComplete;
  if (!eligible) return genericResponse();

  const { data: claimData, error: claimError } = await admin.rpc("claim_account_verification", {
    p_account_id: account.account_id,
    p_purpose: purpose,
  });
  if (claimError) {
    console.error("[POS_VERIFICATION] Rate-limit reservation failed.", { code: claimError.code });
    return jsonResponse({ error: { message: "Verification is unavailable" } }, 500);
  }
  const claim = (Array.isArray(claimData) ? claimData[0] : claimData) as VerificationClaim | null;
  if (!claim?.allowed || !claim.request_id) return genericResponse(claim?.retry_after_seconds ?? 60);

  let authUserId = account.auth_user_id;
  try {
    if (authUserId) {
      const { data, error } = await admin.auth.admin.getUserById(authUserId);
      if (error || normalizePhone(data.user?.phone) !== phone) throw new Error("Auth identity phone mismatch");
    } else {
      const { data: existingAuthUserId, error: findError } = await admin.rpc("find_auth_user_by_phone", { p_phone: phone });
      if (findError) throw findError;
      authUserId = typeof existingAuthUserId === "string" ? existingAuthUserId : null;

      if (authUserId) {
        const { data: conflict, error: conflictError } = await admin.from("accounts")
          .select("account_id")
          .eq("auth_user_id", authUserId)
          .neq("account_id", account.account_id)
          .maybeSingle();
        if (conflictError || conflict) throw new Error("Auth identity already linked");
      } else {
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          phone,
          phone_confirm: false,
          user_metadata: { application: "marketsync-pos" },
        });
        if (createError || !created.user) throw createError ?? new Error("Auth user creation failed");
        authUserId = created.user.id;
      }

      const { data: linkedRows, error: linkError } = await admin.from("accounts")
        .update({ auth_user_id: authUserId })
        .eq("account_id", account.account_id)
        .is("auth_user_id", null)
        .select("account_id, auth_user_id");
      if (linkError) throw linkError;
      const linked = Array.isArray(linkedRows) ? linkedRows[0] : null;
      if (!linked || linked.auth_user_id !== authUserId) throw new Error("Account linkage changed");
    }

    if (purpose === "activation") {
      const { error } = await admin.from("accounts")
        .update({ status: "pending", is_verified: false })
        .eq("account_id", account.account_id)
        .eq("auth_user_id", authUserId);
      if (error) throw error;
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: otpError } = await authClient.auth.signInWithOtp({
      phone,
      options: { channel: "sms", shouldCreateUser: false },
    });
    if (otpError) throw otpError;

    await admin.from("account_verification_requests")
      .update({ status: "sent" })
      .eq("id", claim.request_id);
    console.info("[POS_VERIFICATION] OTP requested.", {
      accountId: String(account.account_id),
      purpose,
      phone: maskPhone(phone),
    });
    return genericResponse(60);
  } catch (error) {
    await admin.from("account_verification_requests")
      .update({ status: "failed" })
      .eq("id", claim.request_id);
    console.error("[POS_VERIFICATION] OTP request failed.", {
      accountId: String(account.account_id),
      purpose,
      message: error instanceof Error ? error.message.replaceAll(phone, maskPhone(phone)) : "Unknown error",
    });
    return jsonResponse({ error: { message: "Unable to send a verification code" } }, 503);
  }
});
