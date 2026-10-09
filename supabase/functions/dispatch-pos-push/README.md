# POS push dispatch setup

The function sends Android notifications through Expo Push Service whenever a database webhook posts a new `public.notifications` row.

1. Create an Expo access token and a separate random webhook secret.
2. Configure the function secrets without committing their values:

   ```sh
   npx supabase secrets set EXPO_ACCESS_TOKEN=... PUSH_WEBHOOK_SECRET=...
   ```

3. Deploy the function:

   ```sh
   npx supabase functions deploy dispatch-pos-push --no-verify-jwt
   ```

4. In Supabase Database Webhooks, create an `INSERT` webhook for `public.notifications` targeting the `dispatch-pos-push` Edge Function. Add the HTTP header `x-push-webhook-secret` with the same webhook secret.
5. Confirm webhook calls in the Supabase webhook logs and push attempts in `public.push_notification_deliveries`.

The function intentionally returns `401` when the webhook secret is absent or incorrect, and `500` while the Expo access token is not configured.
