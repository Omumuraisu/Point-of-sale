# Email OTP deployment checklist

Email and phone providers are enabled on the linked project. Before releasing email OTP:

1. In Supabase Dashboard, add `https://marketsync.me/pos/otp` to the Authentication redirect URL allow-list. This URL is a template discriminator only; the mobile app does not navigate to it.
2. Open **Authentication > Email Templates**.
3. Open **Magic link or OTP** and copy the versioned subject and body from `email-templates/magic-link-or-otp-subject.txt` and `email-templates/magic-link-or-otp.html`.
4. Open **Confirm sign up** and copy the versioned subject and body from `email-templates/confirm-sign-up-subject.txt` and `email-templates/confirm-sign-up.html`. Supabase uses this template when activation creates an unconfirmed Auth user before requesting the OTP.
5. In both templates, `https://marketsync.me/delivery/otp` and `https://marketsync.me/pos/otp` must select the OTP branch, which displays `{{ .Token }}`; unrelated redirect URLs retain their normal link branch.
6. Configure production SMTP under **Project Settings > Authentication > SMTP Settings**. Do not rely on Supabase's restricted trial sender in production.
7. Run the reconciliation script in dry-run mode, resolve every duplicate/conflict, then run it with `--apply`.
8. Apply `20261012000000_email_phone_auth.sql`.
9. Deploy `start-pos-account-verification`, `complete-pos-account-password`, and `start-developer-activation-test`.
10. Publish the updated app after the Edge Functions. Older clients that omit the password-completion `channel` remain supported during the rollout.
11. Test email activation, recovery, password change, resend, and developer activation, plus one SMS activation, before publishing the mobile app. Confirm the OTP is delivered, not merely accepted by the provider.

Configure the redirect allow-list and shared email template before deploying the migration or Edge Functions. The verification function continues accepting the legacy `{ phone, purpose }` request during the transition.
