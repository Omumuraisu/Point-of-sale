import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

interface SendSmsHookPayload {
  user: { phone?: unknown };
  sms: { otp?: unknown };
}

interface SemaphoreMessage { status?: string }

const SEMAPHORE_OTP_URL = "https://api.semaphore.co/api/v4/otp";
const PHILIPPINE_MOBILE_PATTERN = /^\+639\d{9}$/;

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const errorResponse = (status: number, message: string): Response =>
  jsonResponse({ error: { http_code: status, message } }, status);

const isFailedSemaphoreMessage = (message: SemaphoreMessage): boolean => {
  const status = message.status?.toLowerCase();
  return status === "failed" || status === "refunded";
};

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return errorResponse(405, "Method not allowed");

  const semaphoreApiKey = Deno.env.get("SEMAPHORE_API_KEY");
  const semaphoreSenderName = Deno.env.get("SEMAPHORE_SENDER_NAME");
  const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET");
  if (!semaphoreApiKey || !semaphoreSenderName || !hookSecret) {
    console.error("[SEND_SMS] Required server secrets are missing.");
    return errorResponse(500, "SMS service is not configured");
  }

  const rawPayload = await request.text();
  let payload: SendSmsHookPayload;
  try {
    const webhook = new Webhook(hookSecret.replace(/^v1,whsec_/, ""));
    payload = webhook.verify(rawPayload, Object.fromEntries(request.headers)) as SendSmsHookPayload;
  } catch (error) {
    console.error("[SEND_SMS] Hook signature validation failed.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return errorResponse(401, "Invalid Send SMS hook request");
  }

  const rawPhone = payload.user?.phone;
  const rawOtp = payload.sms?.otp;
  const phone = typeof rawPhone === "string" || typeof rawPhone === "number" ? String(rawPhone).trim() : "";
  const otp = typeof rawOtp === "string" || typeof rawOtp === "number" ? String(rawOtp).trim() : "";
  if (!phone || !otp) return errorResponse(400, "The phone number or OTP is missing");
  if (!PHILIPPINE_MOBILE_PATTERN.test(phone)) {
    return errorResponse(400, "Only Philippine mobile numbers in +639XXXXXXXXX format are supported");
  }

  const body = new URLSearchParams({
    apikey: semaphoreApiKey,
    number: phone.slice(1),
    message: "Your verification code is {otp}. Do not share this code.",
    code: otp,
    sendername: semaphoreSenderName,
  });

  try {
    const semaphoreResponse = await fetch(SEMAPHORE_OTP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const result: unknown = await semaphoreResponse.json().catch(() => null);
    const messages = Array.isArray(result) ? result as SemaphoreMessage[] : [];
    if (!semaphoreResponse.ok || messages.length === 0 || messages.some(isFailedSemaphoreMessage)) {
      console.error("[SEND_SMS] Semaphore rejected the SMS request.", { status: semaphoreResponse.status });
      return errorResponse(502, "The SMS provider could not send the OTP");
    }
    return jsonResponse({}, 200);
  } catch (error) {
    console.error("[SEND_SMS] Semaphore request failed.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return errorResponse(502, "The SMS provider could not be reached");
  }
});
