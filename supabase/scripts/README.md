# POS Auth Email Reconciliation

Run this before the email uniqueness migration. It performs a dry run unless `--apply` is supplied.

Required environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Commands:

```powershell
node supabase/scripts/reconcile-pos-auth-emails.mjs
node supabase/scripts/reconcile-pos-auth-emails.mjs --apply
```

The script considers only active, verified accounts with an existing `auth_user_id`. It skips invalid or duplicate contacts and prints masked diagnostics. Never place the service-role key in the mobile app or commit it to the repository.
