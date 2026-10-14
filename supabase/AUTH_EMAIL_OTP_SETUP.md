# Email OTP deployment checklist

Email and phone providers are enabled on the linked project. Before releasing email OTP:

1. In Supabase Dashboard, open **Authentication > Email Templates > Magic Link / OTP**.
2. Ensure the message contains `{{ .Token }}` so users receive the six-digit code expected by the app.
3. Configure production SMTP under **Project Settings > Authentication > SMTP Settings**. Do not rely on Supabase's restricted trial sender in production.
4. Run the reconciliation script in dry-run mode, resolve every duplicate/conflict, then run it with `--apply`.
5. Apply `20261012000000_email_phone_auth.sql`.
6. Deploy `start-pos-account-verification`, `complete-pos-account-password`, and `start-developer-activation-test`.
7. Test one email-and-phone account and one phone-only account before publishing the mobile app.

Deploy the migration and Edge Functions before the updated app. The verification function continues accepting the legacy `{ phone, purpose }` request during the transition.
