import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

interface SendSmsHookPayload {
  user: { phone?: unknown };
  sms: { otp?: unknown };
}

interface SemaphoreMessage {
  message_id?: string | number;
  status?: string;
}

// Supabase Auth is the source of truth for the OTP. Use Semaphore's priority
// message route so the provider delivers that exact code instead of involving
// a second OTP generator.
const SEMAPHORE_PRIORITY_URL = "https://api.semaphore.co/api/v4/priority";

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const errorResponse = (status: number, message: string, debugId: string): Response =>
  jsonResponse({ error: { http_code: status, message, debug_id: debugId } }, status);

const isFailedSemaphoreMessage = (message: SemaphoreMessage): boolean => {
  const status = message.status?.toLowerCase();
  return status === "failed" || status === "refunded";
};

const maskPhone = (phone: string): string => `***${phone.slice(-4)}`;

const normalizePhilippinePhone = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;
  return "";
};

const sanitizeSemaphoreMessages = (messages: SemaphoreMessage[]) =>
  messages.map((message) => ({
    messageId: message.message_id === undefined ? null : String(message.message_id),
    status: typeof message.status === "string" ? message.status : null,
  }));

Deno.serve(async (request: Request): Promise<Response> => {
  const debugId = crypto.randomUUID();
  const logInfo = (stage: string, details: Record<string, unknown> = {}) =>
    console.info("[SEND_SMS]", { debugId, stage, ...details });
  const logError = (stage: string, details: Record<string, unknown> = {}) =>
    console.error("[SEND_SMS]", { debugId, stage, ...details });

  logInfo("hook_request_received", { method: request.method });
  if (request.method !== "POST") {
    logInfo("hook_request_rejected", { reason: "method_not_allowed" });
    return errorResponse(405, "Method not allowed", debugId);
  }

  const semaphoreApiKey = Deno.env.get("SEMAPHORE_API_KEY");
  const semaphoreSenderName = Deno.env.get("SEMAPHORE_SENDER_NAME");
  const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET");
  if (!semaphoreApiKey || !semaphoreSenderName || !hookSecret) {
    const missingConfiguration = [
      !semaphoreApiKey ? "SEMAPHORE_API_KEY" : null,
      !semaphoreSenderName ? "SEMAPHORE_SENDER_NAME" : null,
      !hookSecret ? "SEND_SMS_HOOK_SECRET" : null,
    ].filter(Boolean);
    logError("configuration_invalid", { missingConfiguration });
    return errorResponse(500, "SMS service is not configured", debugId);
  }
  logInfo("configuration_validated");

  const rawPayload = await request.text();
  let payload: SendSmsHookPayload;
  try {
    const webhook = new Webhook(hookSecret.replace(/^v1,whsec_/, ""));
    payload = webhook.verify(rawPayload, Object.fromEntries(request.headers)) as SendSmsHookPayload;
    logInfo("hook_signature_validated");
  } catch (error) {
    logError("hook_signature_validation_failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return errorResponse(401, "Invalid Send SMS hook request", debugId);
  }

  const rawPhone = payload.user?.phone;
  const rawOtp = payload.sms?.otp;
  const phoneValue = typeof rawPhone === "string" || typeof rawPhone === "number" ? String(rawPhone).trim() : "";
  const otp = typeof rawOtp === "string" || typeof rawOtp === "number" ? String(rawOtp).trim() : "";
  if (!phoneValue || !otp) {
    logInfo("hook_payload_rejected", {
      reason: "missing_phone_or_otp",
      phonePresent: Boolean(phoneValue),
      otpPresent: Boolean(otp),
    });
    return errorResponse(400, "The phone number or OTP is missing", debugId);
  }
  const phone = normalizePhilippinePhone(phoneValue);
  if (!phone) {
    logInfo("hook_payload_rejected", {
      reason: "invalid_phone_format",
      phone: maskPhone(phoneValue),
    });
    return errorResponse(400, "Only Philippine mobile numbers in +639XXXXXXXXX format are supported", debugId);
  }
  logInfo("hook_payload_validated", { phone: maskPhone(phone) });

  const body = new URLSearchParams({
    apikey: semaphoreApiKey,
    number: phone.slice(1),
    message: `Your verification code is ${otp}. Do not share this code.`,
    sendername: semaphoreSenderName,
  });

  try {
    logInfo("semaphore_dispatch_started", {
      endpoint: SEMAPHORE_PRIORITY_URL,
      phone: maskPhone(phone),
    });
    const semaphoreResponse = await fetch(SEMAPHORE_PRIORITY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const result: unknown = await semaphoreResponse.json().catch(() => null);
    const messages = Array.isArray(result) ? result as SemaphoreMessage[] : [];
    const providerMessages = sanitizeSemaphoreMessages(messages);
    logInfo("semaphore_response_received", {
      phone: maskPhone(phone),
      httpStatus: semaphoreResponse.status,
      responseType: Array.isArray(result) ? "array" : result === null ? "empty_or_non_json" : typeof result,
      messageCount: messages.length,
      messages: providerMessages,
    });
    if (!semaphoreResponse.ok || messages.length === 0 || messages.some(isFailedSemaphoreMessage)) {
      logError("semaphore_dispatch_rejected", {
        phone: maskPhone(phone),
        httpStatus: semaphoreResponse.status,
        messages: providerMessages,
      });
      return errorResponse(502, "The SMS provider could not send the OTP", debugId);
    }
    logInfo("semaphore_dispatch_succeeded", {
      phone: maskPhone(phone),
      httpStatus: semaphoreResponse.status,
      messages: providerMessages,
    });
    return jsonResponse({}, 200);
  } catch (error) {
    logError("semaphore_request_failed", {
      phone: maskPhone(phone),
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return errorResponse(502, "The SMS provider could not be reached", debugId);
  }
});
