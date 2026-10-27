import { createClient } from "npm:@supabase/supabase-js@2";

// Keep developer activation-test emails on the same POS-specific OTP template
// branch as the normal activation and recovery flows.
const POS_EMAIL_REDIRECT_TO = "https://marketsync.me/pos/otp";

type AccountRow = {
  account_id: number;
  auth_user_id: string | null;
  phone_number: string | null;
  email: string | null;
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

const errorResponse = (
  status: number,
  message: string,
  debugId: string,
  reason?: string | null,
  retryAfterSeconds = 0,
): Response =>
  jsonResponse({
    error: {
      message,
      debug_id: debugId,
      ...(reason ? { reason } : {}),
      ...(retryAfterSeconds > 0 ? { retry_after_seconds: retryAfterSeconds } : {}),
    },
  }, status);

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
const maskEmail = (email: string): string => `${email.slice(0, Math.min(2, email.indexOf("@")))}***@${email.split("@")[1]}`;

Deno.serve(async (request: Request): Promise<Response> => {
  const debugId = crypto.randomUUID();
  const logInfo = (stage: string, details: Record<string, unknown> = {}) =>
    console.info("[DEVELOPER_ACTIVATION_TEST]", { debugId, stage, ...details });
  const logError = (stage: string, details: Record<string, unknown> = {}) =>
    console.error("[DEVELOPER_ACTIVATION_TEST]", { debugId, stage, ...details });

  logInfo("request_received", { method: request.method });
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    logInfo("request_rejected", { reason: "method_not_allowed" });
    return errorResponse(405, "Method not allowed", debugId, "method_not_allowed");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    logError("configuration_invalid");
    return errorResponse(500, "Activation testing is unavailable", debugId, "configuration_invalid");
  }

  let requestedChannel: "email" | "sms" = "sms";
  try {
    const input = await request.json() as { channel?: unknown };
    if (input.channel === "email" || input.channel === "sms") requestedChannel = input.channel;
  } catch {
    requestedChannel = "sms";
  }

  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    logInfo("authentication_rejected", { reason: "missing_token" });
    return errorResponse(401, "Sign in with a developer account to run this test", debugId, "missing_token");
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    logInfo("authentication_rejected", { reason: "invalid_or_expired_token" });
    return errorResponse(401, "Your session has expired. Sign in and try again", debugId, "invalid_or_expired_token");
  }
  logInfo("authentication_succeeded", { authUserId: userData.user.id });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: account, error: accountError } = await admin.from("accounts")
    .select("account_id, auth_user_id, phone_number, email, status, is_verified, user_type")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle<AccountRow>();

  if (
    accountError || !account || account.user_type !== "developer" ||
    account.status !== "active" || account.is_verified !== true
  ) {
    logInfo("account_validation_rejected", {
      reason: accountError ? "account_lookup_failed" : "ineligible_account",
      code: accountError?.code ?? null,
    });
    return errorResponse(403, "Only an active developer account can run this test", debugId, "ineligible_account");
  }
  logInfo("account_validation_succeeded", { accountId: String(account.account_id) });

  const phone = normalizePhone(account.phone_number);
  const email = normalizeEmail(account.email);
  const identifier = requestedChannel === "email" ? email : phone;
  const identifierLabel = requestedChannel === "email" ? maskEmail(email) : maskPhone(phone);
  if (!identifier) {
    logInfo("identifier_validation_rejected", {
      accountId: String(account.account_id),
      channel: requestedChannel,
      reason: "missing_account_identifier",
    });
    return errorResponse(
      409,
      `The developer account does not have a valid ${requestedChannel === "email" ? "email" : "phone number"}`,
      debugId,
      "missing_account_identifier",
    );
  }

  const { data: candidates, error: lookupError } = await admin.from("accounts")
    .select("account_id, phone_number, email");
  const matchingAccounts = ((candidates ?? []) as Pick<AccountRow, "account_id" | "phone_number" | "email">[])
    .filter((candidate) => requestedChannel === "email"
      ? normalizeEmail(candidate.email) === identifier
      : normalizePhone(candidate.phone_number) === identifier);
  if (lookupError || matchingAccounts.length !== 1 || matchingAccounts[0].account_id !== account.account_id) {
    logInfo("identifier_validation_rejected", {
      accountId: String(account.account_id),
      channel: requestedChannel,
      identifier: identifierLabel,
      reason: "identifier_record_conflict",
      matchingAccountCount: matchingAccounts.length,
      code: lookupError?.code ?? null,
    });
    return errorResponse(
      409,
      "The selected contact is linked to conflicting account records",
      debugId,
      "identifier_record_conflict",
    );
  }
  const authIdentifier = requestedChannel === "email"
    ? normalizeEmail(userData.user.email)
    : normalizePhone(userData.user.phone);
  if (authIdentifier && authIdentifier !== identifier) {
    return errorResponse(409, "The selected contact does not match its authentication identity", debugId, "auth_identifier_mismatch");
  }
  if (!authIdentifier) {
    const updates = requestedChannel === "email" ? { email: identifier } : { phone: identifier };
    const { error: updateError } = await admin.auth.admin.updateUserById(userData.user.id, updates);
    if (updateError) return errorResponse(409, "Unable to attach the selected contact", debugId, "auth_identifier_update_failed");
  }
  logInfo("identifier_validation_succeeded", {
    accountId: String(account.account_id),
    channel: requestedChannel,
    identifier: identifierLabel,
  });

  const { data: claimData, error: claimError } = await admin.rpc("claim_account_verification", {
    p_account_id: account.account_id,
    p_purpose: "activation",
  });
  if (claimError) {
    logError("rate_limit_check_failed", { accountId: String(account.account_id), code: claimError.code });
    return errorResponse(500, "Unable to reserve an activation test", debugId, "rate_limit_check_failed");
  }

  const claim = (Array.isArray(claimData) ? claimData[0] : claimData) as VerificationClaim | null;
  logInfo("rate_limit_checked", {
    accountId: String(account.account_id),
    allowed: claim?.allowed ?? false,
    reason: claim?.reason ?? null,
    retryAfterSeconds: claim?.retry_after_seconds ?? null,
  });
  if (!claim?.allowed || !claim.request_id) {
    const reason = claim?.reason ?? "rate_limit_rejected";
    const message = reason === "cooldown"
      ? "Please wait before requesting another OTP."
      : reason === "account_daily_limit"
      ? "Daily OTP request limit reached."
      : reason === "global_hourly_limit"
      ? "The verification service hourly request limit has been reached."
      : "The OTP request limit has been reached.";
    logInfo("otp_dispatch_skipped", {
      accountId: String(account.account_id),
      reason,
      retryAfterSeconds: claim?.retry_after_seconds ?? 60,
    });
    return errorResponse(
      429,
      message,
      debugId,
      reason,
      claim?.retry_after_seconds ?? 60,
    );
  }

  const { error: channelError } = await admin.from("account_verification_requests")
    .update({ channel: requestedChannel })
    .eq("id", claim.request_id);
  if (channelError) return errorResponse(500, "Unable to reserve an activation test", debugId, "channel_update_failed");

  let stateChanged = false;
  try {
    logInfo("account_state_transition_started", { accountId: String(account.account_id) });
    const { data: changedRows, error: stateError } = await admin.from("accounts")
      .update({ status: "pending", is_verified: false })
      .eq("account_id", account.account_id)
      .eq("auth_user_id", userData.user.id)
      .eq("status", "active")
      .eq("is_verified", true)
      .select("account_id");
    if (stateError || !Array.isArray(changedRows) || changedRows.length !== 1) {
      throw new Error("Developer account state changed before the test started");
    }
    stateChanged = true;
    logInfo("account_state_transition_succeeded", {
      accountId: String(account.account_id),
      status: "pending",
      isVerified: false,
    });

    const otpClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    logInfo("otp_dispatch_started", {
      accountId: String(account.account_id),
      channel: requestedChannel,
      identifier: identifierLabel,
    });
    const otpResult = requestedChannel === "email"
      ? await otpClient.auth.signInWithOtp({
        email: identifier,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: POS_EMAIL_REDIRECT_TO,
        },
      })
      : await otpClient.auth.signInWithOtp({ phone: identifier, options: { channel: "sms", shouldCreateUser: false } });
    const { error: otpError } = otpResult;
    if (otpError) throw otpError;

    const { error: sentStatusError } = await admin.from("account_verification_requests")
      .update({ status: "sent" })
      .eq("id", claim.request_id);
    if (sentStatusError) {
      logError("request_status_update_failed", {
        requestId: claim.request_id,
        code: sentStatusError.code,
      });
    }

    logInfo("otp_dispatch_succeeded", {
      accountId: String(account.account_id),
      channel: requestedChannel,
      identifier: identifierLabel,
      requestId: claim.request_id,
    });
    return jsonResponse({ accepted: true, resendAfterSeconds: 60, identifier, channel: requestedChannel, debugId });
  } catch (error) {
    if (stateChanged) {
      logInfo("account_rollback_started", { accountId: String(account.account_id) });
      const { data: rolledBackRows, error: rollbackError } = await admin.from("accounts")
        .update({ status: "active", is_verified: true })
        .eq("account_id", account.account_id)
        .eq("auth_user_id", userData.user.id)
        .eq("status", "pending")
        .eq("is_verified", false)
        .select("account_id");
      if (rollbackError || !Array.isArray(rolledBackRows) || rolledBackRows.length !== 1) {
        logError("account_rollback_failed", {
          accountId: String(account.account_id),
          code: rollbackError?.code ?? "no_rows_updated",
        });
      } else {
        logInfo("account_rollback_succeeded", { accountId: String(account.account_id) });
      }
    }

    await admin.from("account_verification_requests")
      .update({ status: "failed" })
      .eq("id", claim.request_id);
    logError("otp_dispatch_failed", {
      accountId: String(account.account_id),
      message: error instanceof Error ? error.message.replaceAll(identifier, identifierLabel) : "Unknown error",
    });
    return errorResponse(
      503,
      "Unable to send the activation test code. Sign in again or use Activate Account if needed",
      debugId,
      "otp_dispatch_failed",
    );
  }
});
