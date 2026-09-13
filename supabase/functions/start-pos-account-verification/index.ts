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
type ProfileEligibility = {
  eligible: boolean;
  reason: string;
  errorCode: string | null;
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

const errorResponse = (status: number, message: string, debugId: string): Response =>
  jsonResponse({ error: { message, debug_id: debugId } }, status);

const genericResponse = (debugId: string, resendAfterSeconds = 60): Response =>
  jsonResponse({ accepted: true, resendAfterSeconds, debugId });

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
): Promise<ProfileEligibility> => {
  if (account.user_type === "developer") {
    return { eligible: true, reason: "developer_account", errorCode: null };
  }
  if (account.user_type === "business_owner") {
    const { data, error } = await admin.from("business_owner")
      .select("business_owner_id")
      .eq("account_id", account.account_id)
      .is("archived_at", null)
      .maybeSingle();
    return {
      eligible: !error && Boolean(data),
      reason: error ? "business_owner_lookup_failed" : data ? "active_business_owner" : "business_owner_profile_missing",
      errorCode: error?.code ?? null,
    };
  }
  if (account.user_type === "vendor") {
    const { data, error } = await admin.from("vendor")
      .select("vendor_id")
      .eq("account_id", account.account_id)
      .eq("is_approved", true)
      .maybeSingle();
    return {
      eligible: !error && Boolean(data),
      reason: error ? "vendor_lookup_failed" : data ? "approved_vendor" : "vendor_not_approved",
      errorCode: error?.code ?? null,
    };
  }
  return { eligible: false, reason: "unsupported_user_type", errorCode: null };
};

Deno.serve(async (request: Request): Promise<Response> => {
  const debugId = crypto.randomUUID();
  const logInfo = (stage: string, details: Record<string, unknown> = {}) =>
    console.info("[POS_VERIFICATION]", { debugId, stage, ...details });
  const logError = (stage: string, details: Record<string, unknown> = {}) =>
    console.error("[POS_VERIFICATION]", { debugId, stage, ...details });

  logInfo("request_received", { method: request.method });
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    logInfo("request_rejected", { reason: "method_not_allowed" });
    return errorResponse(405, "Method not allowed", debugId);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    const missingConfiguration = [
      !supabaseUrl ? "SUPABASE_URL" : null,
      !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
      !anonKey ? "SUPABASE_ANON_KEY" : null,
    ].filter(Boolean);
    logError("configuration_invalid", { missingConfiguration });
    return errorResponse(500, "Verification is unavailable", debugId);
  }

  let input: { phone?: unknown; purpose?: unknown };
  try {
    input = await request.json();
  } catch {
    logInfo("request_rejected", { reason: "malformed_json" });
    return genericResponse(debugId);
  }

  const phone = normalizePhone(input.phone);
  const purpose = parsePurpose(input.purpose);
  if (!phone || !purpose) {
    logInfo("request_rejected", {
      reason: "invalid_input",
      phoneValid: Boolean(phone),
      purposeValid: Boolean(purpose),
    });
    return genericResponse(debugId);
  }
  logInfo("request_validated", { phone: maskPhone(phone), purpose });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  logInfo("account_lookup_started", { phone: maskPhone(phone), purpose });
  const { data: candidates, error: accountError } = await admin.from("accounts")
    .select("account_id, auth_user_id, phone_number, status, is_verified, user_type")
    .in("user_type", ["business_owner", "vendor", "developer"])
    .in("status", ["active", "pending"]);
  if (accountError) {
    logError("account_lookup_failed", { code: accountError.code });
    return errorResponse(500, "Verification is unavailable", debugId);
  }

  const matches = ((candidates ?? []) as AccountRow[]).filter((row: AccountRow) => normalizePhone(row.phone_number) === phone);
  logInfo("account_lookup_completed", { phone: maskPhone(phone), matchCount: matches.length });
  if (matches.length !== 1) {
    logInfo("otp_dispatch_skipped", { reason: matches.length === 0 ? "account_not_found" : "duplicate_phone_records" });
    return genericResponse(debugId);
  }
  const account = matches[0] as AccountRow;
  const profileEligibility = await hasEligibleProfile(admin, account);
  logInfo("profile_eligibility_checked", {
    accountId: String(account.account_id),
    userType: account.user_type,
    eligible: profileEligibility.eligible,
    reason: profileEligibility.reason,
    code: profileEligibility.errorCode,
  });
  if (!profileEligibility.eligible) {
    logInfo("otp_dispatch_skipped", { accountId: String(account.account_id), reason: profileEligibility.reason });
    return genericResponse(debugId);
  }

  const activationComplete = Boolean(account.auth_user_id && account.status === "active" && account.is_verified);
  const eligible = purpose === "activation" ? !activationComplete : activationComplete;
  logInfo("account_eligibility_checked", {
    accountId: String(account.account_id),
    purpose,
    eligible,
    status: account.status,
    isVerified: account.is_verified,
    hasAuthUser: Boolean(account.auth_user_id),
  });
  if (!eligible) {
    logInfo("otp_dispatch_skipped", { accountId: String(account.account_id), reason: "purpose_not_eligible" });
    return genericResponse(debugId);
  }

  const { data: claimData, error: claimError } = await admin.rpc("claim_account_verification", {
    p_account_id: account.account_id,
    p_purpose: purpose,
  });
  if (claimError) {
    logError("rate_limit_check_failed", { accountId: String(account.account_id), code: claimError.code });
    return errorResponse(500, "Verification is unavailable", debugId);
  }
  const claim = (Array.isArray(claimData) ? claimData[0] : claimData) as VerificationClaim | null;
  logInfo("rate_limit_checked", {
    accountId: String(account.account_id),
    allowed: claim?.allowed ?? false,
    reason: claim?.reason ?? null,
    retryAfterSeconds: claim?.retry_after_seconds ?? null,
    hasRequestId: Boolean(claim?.request_id),
  });
  if (!claim?.allowed || !claim.request_id) {
    logInfo("otp_dispatch_skipped", {
      accountId: String(account.account_id),
      reason: claim?.reason ?? "rate_limit_rejected",
      retryAfterSeconds: claim?.retry_after_seconds ?? 60,
    });
    return genericResponse(debugId, claim?.retry_after_seconds ?? 60);
  }

  let authUserId = account.auth_user_id;
  let failedStage = "auth_identity_validation";
  try {
    if (authUserId) {
      logInfo("auth_identity_validation_started", {
        accountId: String(account.account_id),
        authUserId,
      });
      const { data, error } = await admin.auth.admin.getUserById(authUserId);
      if (error || normalizePhone(data.user?.phone) !== phone) throw new Error("Auth identity phone mismatch");
      logInfo("auth_identity_validation_succeeded", {
        accountId: String(account.account_id),
        authUserId,
      });
    } else {
      failedStage = "auth_identity_lookup";
      logInfo("auth_identity_lookup_started", { accountId: String(account.account_id) });
      const { data: existingAuthUserId, error: findError } = await admin.rpc("find_auth_user_by_phone", { p_phone: phone });
      if (findError) throw findError;
      authUserId = typeof existingAuthUserId === "string" ? existingAuthUserId : null;
      logInfo("auth_identity_lookup_completed", {
        accountId: String(account.account_id),
        identityFound: Boolean(authUserId),
      });

      if (authUserId) {
        failedStage = "auth_identity_conflict_check";
        const { data: conflict, error: conflictError } = await admin.from("accounts")
          .select("account_id")
          .eq("auth_user_id", authUserId)
          .neq("account_id", account.account_id)
          .maybeSingle();
        if (conflictError || conflict) throw new Error("Auth identity already linked");
        logInfo("auth_identity_conflict_check_succeeded", {
          accountId: String(account.account_id),
          authUserId,
        });
      } else {
        failedStage = "auth_identity_creation";
        logInfo("auth_identity_creation_started", {
          accountId: String(account.account_id),
          phone: maskPhone(phone),
        });
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          phone,
          phone_confirm: false,
          user_metadata: { application: "marketsync-pos" },
        });
        if (createError || !created.user) throw createError ?? new Error("Auth user creation failed");
        authUserId = created.user.id;
        logInfo("auth_identity_creation_succeeded", {
          accountId: String(account.account_id),
          authUserId,
        });
      }

      failedStage = "account_identity_link";
      logInfo("account_identity_link_started", {
        accountId: String(account.account_id),
        authUserId,
      });
      const { data: linkedRows, error: linkError } = await admin.from("accounts")
        .update({ auth_user_id: authUserId })
        .eq("account_id", account.account_id)
        .is("auth_user_id", null)
        .select("account_id, auth_user_id");
      if (linkError) throw linkError;
      const linked = Array.isArray(linkedRows) ? linkedRows[0] : null;
      if (!linked || linked.auth_user_id !== authUserId) throw new Error("Account linkage changed");
      logInfo("account_identity_link_succeeded", {
        accountId: String(account.account_id),
        authUserId,
      });
    }

    if (purpose === "activation") {
      failedStage = "account_state_update";
      logInfo("account_state_update_started", { accountId: String(account.account_id), purpose });
      const { error } = await admin.from("accounts")
        .update({ status: "pending", is_verified: false })
        .eq("account_id", account.account_id)
        .eq("auth_user_id", authUserId);
      if (error) throw error;
      logInfo("account_state_update_succeeded", {
        accountId: String(account.account_id),
        status: "pending",
        isVerified: false,
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    failedStage = "otp_dispatch";
    logInfo("otp_dispatch_started", {
      accountId: String(account.account_id),
      purpose,
      phone: maskPhone(phone),
      requestId: claim.request_id,
    });
    const { error: otpError } = await authClient.auth.signInWithOtp({
      phone,
      options: { channel: "sms", shouldCreateUser: false },
    });
    if (otpError) throw otpError;
    logInfo("otp_dispatch_succeeded", {
      accountId: String(account.account_id),
      purpose,
      phone: maskPhone(phone),
      requestId: claim.request_id,
    });

    const { error: sentStatusError } = await admin.from("account_verification_requests")
      .update({ status: "sent" })
      .eq("id", claim.request_id);
    if (sentStatusError) {
      logError("request_status_update_failed", {
        requestId: claim.request_id,
        targetStatus: "sent",
        code: sentStatusError.code,
      });
    } else {
      logInfo("request_status_update_succeeded", {
        requestId: claim.request_id,
        status: "sent",
      });
    }
    return genericResponse(debugId, 60);
  } catch (error) {
    const { error: failedStatusError } = await admin.from("account_verification_requests")
      .update({ status: "failed" })
      .eq("id", claim.request_id);
    if (failedStatusError) {
      logError("request_status_update_failed", {
        requestId: claim.request_id,
        targetStatus: "failed",
        code: failedStatusError.code,
      });
    }
    const errorRecord = typeof error === "object" && error !== null
      ? error as { code?: unknown; status?: unknown }
      : null;
    logError("verification_processing_failed", {
      accountId: String(account.account_id),
      purpose,
      failedStage,
      code: typeof errorRecord?.code === "string" ? errorRecord.code : null,
      status: typeof errorRecord?.status === "number" ? errorRecord.status : null,
      message: error instanceof Error ? error.message.replaceAll(phone, maskPhone(phone)) : "Unknown error",
    });
    return errorResponse(503, "Unable to send a verification code", debugId);
  }
});
