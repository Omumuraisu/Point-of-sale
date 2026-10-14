import { createClient } from "npm:@supabase/supabase-js@2";

type VerificationPurpose = "activation" | "recovery";
type AccountRow = {
  account_id: number;
  auth_user_id: string | null;
  phone_number: string | null;
  email: string | null;
  status: string;
  is_verified: boolean;
  user_type: string;
};
type VerificationChannel = "email" | "sms";
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

const normalizeEmail = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
};

const parseIdentifier = (value: unknown): { value: string; channel: VerificationChannel } | null => {
  const email = normalizeEmail(value);
  if (email) return { value: email, channel: "email" };
  const phone = normalizePhone(value);
  return phone ? { value: phone, channel: "sms" } : null;
};

const maskEmail = (email: string): string => {
  const [localPart, domain] = email.split("@");
  return `${localPart.slice(0, Math.min(2, localPart.length))}***@${domain}`;
};

const maskIdentifier = (value: string, channel: VerificationChannel): string =>
  channel === "email" ? maskEmail(value) : maskPhone(value);

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

  let input: { identifier?: unknown; phone?: unknown; purpose?: unknown };
  try {
    input = await request.json();
  } catch {
    logInfo("request_rejected", { reason: "malformed_json" });
    return genericResponse(debugId);
  }

  const identifier = parseIdentifier(input.identifier ?? input.phone);
  const purpose = parsePurpose(input.purpose);
  if (!identifier || !purpose) {
    logInfo("request_rejected", {
      reason: "invalid_input",
      identifierValid: Boolean(identifier),
      purposeValid: Boolean(purpose),
    });
    return genericResponse(debugId);
  }
  const identifierLabel = maskIdentifier(identifier.value, identifier.channel);
  logInfo("request_validated", { identifier: identifierLabel, channel: identifier.channel, purpose });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  logInfo("account_lookup_started", { identifier: identifierLabel, channel: identifier.channel, purpose });
  const { data: candidates, error: accountError } = await admin.from("accounts")
    .select("account_id, auth_user_id, phone_number, email, status, is_verified, user_type")
    .in("user_type", ["business_owner", "vendor", "developer"])
    .in("status", ["active", "pending"]);
  if (accountError) {
    logError("account_lookup_failed", { code: accountError.code });
    return errorResponse(500, "Verification is unavailable", debugId);
  }

  const matches = ((candidates ?? []) as AccountRow[]).filter((row: AccountRow) => (
    identifier.channel === "email"
      ? normalizeEmail(row.email) === identifier.value
      : normalizePhone(row.phone_number) === identifier.value
  ));
  logInfo("account_lookup_completed", { identifier: identifierLabel, channel: identifier.channel, matchCount: matches.length });
  if (matches.length !== 1) {
    logInfo("otp_dispatch_skipped", { reason: matches.length === 0 ? "account_not_found" : "duplicate_identifier_records" });
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

  const { error: channelError } = await admin.from("account_verification_requests")
    .update({ channel: identifier.channel })
    .eq("id", claim.request_id);
  if (channelError) {
    logError("request_channel_update_failed", { requestId: claim.request_id, code: channelError.code });
    return errorResponse(500, "Verification is unavailable", debugId);
  }

  let authUserId = account.auth_user_id;
  const accountPhone = normalizePhone(account.phone_number);
  const accountEmail = normalizeEmail(account.email);
  let failedStage = "auth_identity_validation";
  try {
    if (!authUserId) {
      failedStage = "auth_identity_lookup";
      logInfo("auth_identity_lookup_started", { accountId: String(account.account_id) });
      const lookup = identifier.channel === "email"
        ? await admin.rpc("find_auth_user_by_email", { p_email: identifier.value })
        : await admin.rpc("find_auth_user_by_phone", { p_phone: identifier.value });
      const { data: existingAuthUserId, error: findError } = lookup;
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
          channel: identifier.channel,
          identifier: identifierLabel,
        });
        const authAttributes: {
          email?: string;
          phone?: string;
          email_confirm?: boolean;
          phone_confirm?: boolean;
          user_metadata: Record<string, string>;
        } = {
          user_metadata: { application: "marketsync-pos" },
        };
        if (accountEmail) {
          authAttributes.email = accountEmail;
          authAttributes.email_confirm = false;
        }
        if (accountPhone) {
          authAttributes.phone = accountPhone;
          authAttributes.phone_confirm = false;
        }
        const { data: created, error: createError } = await admin.auth.admin.createUser(authAttributes);
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

    failedStage = "auth_identity_validation";
    if (!authUserId) throw new Error("Auth identity missing after provisioning");
    logInfo("auth_identity_validation_started", { accountId: String(account.account_id), authUserId });
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(authUserId);
    if (authError || !authData.user) throw authError ?? new Error("Auth identity missing");
    const currentEmail = normalizeEmail(authData.user.email);
    const currentPhone = normalizePhone(authData.user.phone);
    if (currentEmail && accountEmail && currentEmail !== accountEmail) throw new Error("Auth identity email mismatch");
    if (currentPhone && accountPhone && currentPhone !== accountPhone) throw new Error("Auth identity phone mismatch");

    const updates: { email?: string; phone?: string } = {};
    if (accountEmail && !currentEmail) updates.email = accountEmail;
    if (accountPhone && !currentPhone) updates.phone = accountPhone;
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, updates);
      if (updateError) throw updateError;
    }
    logInfo("auth_identity_validation_succeeded", { accountId: String(account.account_id), authUserId });

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
      channel: identifier.channel,
      identifier: identifierLabel,
      requestId: claim.request_id,
    });
    const otpResult = identifier.channel === "email"
      ? await authClient.auth.signInWithOtp({
        email: identifier.value,
        options: { shouldCreateUser: false },
      })
      : await authClient.auth.signInWithOtp({
        phone: identifier.value,
        options: { channel: "sms", shouldCreateUser: false },
      });
    const { error: otpError } = otpResult;
    if (otpError) throw otpError;
    logInfo("otp_dispatch_succeeded", {
      accountId: String(account.account_id),
      purpose,
      channel: identifier.channel,
      identifier: identifierLabel,
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
      message: error instanceof Error ? error.message.replaceAll(identifier.value, identifierLabel) : "Unknown error",
    });
    return errorResponse(503, "Unable to send a verification code", debugId);
  }
});
