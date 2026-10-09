import { createClient } from "npm:@supabase/supabase-js@2";

type NotificationRecord = {
  notification_id: number;
  recipient_account_id: number;
  notification_type: string;
  title: string | null;
  message: string | null;
  business_id: number | null;
  billing_cycle_id: number | null;
  billing_month: string | null;
  stall_number: string | null;
};

type WebhookPayload = {
  type: "INSERT";
  table: "notifications";
  schema: "public";
  record: NotificationRecord;
  old_record: null;
};

type PushTokenRow = {
  push_token_id: number;
  expo_push_token: string;
};

type QueuedDelivery = PushTokenRow & { delivery_id: number };

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

const jsonResponse = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const getSecretKey = (): string | null => {
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyKey) return legacyKey;
  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    return secretKeys.default ?? null;
  } catch {
    return null;
  }
};

const secureEquals = (left: string, right: string): boolean => {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  leftBytes.forEach((value, index) => { difference |= value ^ rightBytes[index]; });
  return difference === 0;
};

const monthLabel = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
};

const pushTitle = (record: NotificationRecord): string => {
  const month = monthLabel(record.billing_month);
  const titles: Record<string, string> = {
    billing_submitted: "Monthly Bill",
    billing_payment_reminder: "Billing payment reminder",
    billing_due_soon: "Bill Due Soon",
    billing_due_today: "Bill Due Today",
    billing_overdue: "Billing Overdue",
    billing_paid: "Billing payment received",
    vendor_compliance_requested: "Vendor compliance request",
  };
  const title = record.title?.trim() || titles[record.notification_type] || "MarketSync notification";
  return month && record.notification_type.startsWith("billing_") ? `${title} - ${month}` : title;
};

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const configuredWebhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";
  const suppliedWebhookSecret = request.headers.get("x-push-webhook-secret") ?? "";
  if (!configuredWebhookSecret || !secureEquals(configuredWebhookSecret, suppliedWebhookSecret)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = getSecretKey();
  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  if (!supabaseUrl || !serviceRoleKey || !expoAccessToken) {
    console.error("[POS_PUSH] Missing server configuration");
    return jsonResponse({ error: "Push delivery is not configured" }, 500);
  }

  let payload: WebhookPayload;
  try {
    payload = await request.json() as WebhookPayload;
  } catch {
    return jsonResponse({ error: "Malformed webhook payload" }, 400);
  }

  const record = payload?.record;
  if (payload.type !== "INSERT" || payload.table !== "notifications" || payload.schema !== "public"
    || !Number.isSafeInteger(record?.notification_id) || !Number.isSafeInteger(record?.recipient_account_id)) {
    return jsonResponse({ error: "Unsupported webhook payload" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: tokenData, error: tokenError } = await admin
    .from("pos_push_tokens")
    .select("push_token_id, expo_push_token")
    .eq("account_id", record.recipient_account_id)
    .eq("active", true);
  if (tokenError) {
    console.error("[POS_PUSH] Token lookup failed", { notificationId: record.notification_id, code: tokenError.code });
    return jsonResponse({ error: "Token lookup failed" }, 500);
  }

  const queued: QueuedDelivery[] = [];
  for (const token of (tokenData ?? []) as PushTokenRow[]) {
    const { data: delivery, error } = await admin.from("push_notification_deliveries")
      .insert({
        notification_id: record.notification_id,
        push_token_id: token.push_token_id,
        expo_push_token: token.expo_push_token,
        status: "queued",
      })
      .select("delivery_id")
      .single();
    if (!error && delivery) queued.push({ ...token, delivery_id: delivery.delivery_id as number });
    else if (error?.code !== "23505") {
      console.error("[POS_PUSH] Delivery reservation failed", { notificationId: record.notification_id, code: error?.code });
    }
  }

  if (queued.length === 0) {
    return jsonResponse({ delivered: 0, skipped: (tokenData ?? []).length });
  }

  const messages = queued.map((token) => ({
    to: token.expo_push_token,
    title: pushTitle(record),
    body: record.message?.trim() || "You have a new MarketSync notification.",
    sound: "default",
    channelId: "pos-alerts",
    priority: "high",
    data: {
      notificationId: record.notification_id,
      notificationType: record.notification_type,
      businessId: record.business_id,
      billingCycleId: record.billing_cycle_id,
      billingMonth: record.billing_month,
      stallNumber: record.stall_number,
    },
  }));

  let tickets: ExpoTicket[];
  try {
    const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Authorization": `Bearer ${expoAccessToken}`,
      },
      body: JSON.stringify(messages),
    });
    const result = await expoResponse.json() as { data?: ExpoTicket[]; errors?: unknown };
    if (!expoResponse.ok || !Array.isArray(result.data)) throw new Error(`Expo push request failed (${expoResponse.status})`);
    tickets = result.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Expo push request failed";
    await admin.from("push_notification_deliveries").update({
      status: "error", error_code: "request_failed", error_message: message, updated_at: new Date().toISOString(),
    }).in("delivery_id", queued.map((item) => item.delivery_id));
    console.error("[POS_PUSH] Expo request failed", { notificationId: record.notification_id, message });
    return jsonResponse({ error: "Push request failed" }, 502);
  }

  await Promise.all(queued.map(async (item, index) => {
    const ticket = tickets[index];
    const succeeded = ticket?.status === "ok";
    const errorCode = succeeded ? null : ticket?.details?.error ?? "unknown_error";
    await admin.from("push_notification_deliveries").update({
      status: succeeded ? "sent" : "error",
      expo_ticket_id: ticket?.id ?? null,
      error_code: errorCode,
      error_message: succeeded ? null : ticket?.message ?? "Expo rejected the notification",
      updated_at: new Date().toISOString(),
    }).eq("delivery_id", item.delivery_id);

    if (errorCode === "DeviceNotRegistered") {
      await admin.from("pos_push_tokens").update({
        active: false,
        last_error: errorCode,
        updated_at: new Date().toISOString(),
      }).eq("push_token_id", item.push_token_id);
    }
  }));

  return jsonResponse({ delivered: tickets.filter((ticket) => ticket.status === "ok").length, attempted: queued.length });
});
