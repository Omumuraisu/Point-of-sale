# Email OTP deployment checklist

Email and phone providers are enabled on the linked project. Before releasing email OTP:

1. In Supabase Dashboard, add `https://marketsync.me/pos/otp` to the Authentication redirect URL allow-list. This URL is a template discriminator only; the mobile app does not navigate to it.
2. Open **Authentication > Email Templates > Magic Link / OTP**.
3. Update the shared template so both `https://marketsync.me/delivery/otp` and `https://marketsync.me/pos/otp` select the OTP branch, and ensure that branch displays `{{ .Token }}`. Preserve the normal magic-link branch for other redirect URLs.
4. Configure production SMTP under **Project Settings > Authentication > SMTP Settings**. Do not rely on Supabase's restricted trial sender in production.
5. Run the reconciliation script in dry-run mode, resolve every duplicate/conflict, then run it with `--apply`.
6. Apply `20261012000000_email_phone_auth.sql`.
7. Deploy `start-pos-account-verification`, `complete-pos-account-password`, and `start-developer-activation-test`.
8. Publish the updated app after the Edge Functions. Older clients that omit the password-completion `channel` remain supported during the rollout.
9. Test email activation, recovery, password change, resend, and developer activation, plus one SMS activation, before publishing the mobile app. Confirm the OTP is delivered, not merely accepted by the provider.

Configure the redirect allow-list and shared email template before deploying the migration or Edge Functions. The verification function continues accepting the legacy `{ phone, purpose }` request during the transition.
