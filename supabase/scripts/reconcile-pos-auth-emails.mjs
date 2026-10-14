import { createClient } from '@supabase/supabase-js';

const applyChanges = process.argv.includes('--apply');
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
}

const normalizeEmail = (value) => {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
};

const maskEmail = (email) => {
  const [localPart, domain] = email.split('@');
  return `${localPart.slice(0, Math.min(2, localPart.length))}***@${domain}`;
};

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const accounts = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await admin.from('accounts')
    .select('account_id, auth_user_id, email, status, is_verified')
    .range(from, from + 999);
  if (error) throw error;
  accounts.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

const users = [];
for (let page = 1; ; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  users.push(...data.users);
  if (data.users.length < 1000) break;
}

const accountsByEmail = new Map();
for (const account of accounts) {
  const email = normalizeEmail(account.email);
  if (!email) continue;
  const group = accountsByEmail.get(email) ?? [];
  group.push(account.account_id);
  accountsByEmail.set(email, group);
}

const authById = new Map(users.map((user) => [user.id, user]));
const authByEmail = new Map(users.flatMap((user) => {
  const email = normalizeEmail(user.email);
  return email ? [[email, user.id]] : [];
}));
const report = {
  mode: applyChanges ? 'apply' : 'dry-run',
  eligible: 0,
  updated: 0,
  alreadyConfirmed: 0,
  skipped: 0,
  failed: 0,
  issues: [],
};

for (const account of accounts) {
  if (account.status !== 'active' || account.is_verified !== true || !account.auth_user_id) continue;
  const email = normalizeEmail(account.email);
  if (!email) continue;
  report.eligible += 1;
  const issue = (reason) => {
    report.skipped += 1;
    report.issues.push({ accountId: String(account.account_id), email: maskEmail(email), reason });
  };

  if ((accountsByEmail.get(email) ?? []).length !== 1) {
    issue('duplicate_account_email');
    continue;
  }
  const user = authById.get(account.auth_user_id);
  if (!user) {
    issue('auth_user_missing');
    continue;
  }
  const conflictingAuthId = authByEmail.get(email);
  if (conflictingAuthId && conflictingAuthId !== user.id) {
    issue('email_belongs_to_another_auth_user');
    continue;
  }
  const currentEmail = normalizeEmail(user.email);
  if (currentEmail && currentEmail !== email) {
    issue('auth_user_has_different_email');
    continue;
  }
  if (currentEmail === email && user.email_confirmed_at) {
    report.alreadyConfirmed += 1;
    continue;
  }
  if (!applyChanges) {
    report.updated += 1;
    continue;
  }
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email,
    email_confirm: true,
  });
  if (error) {
    report.failed += 1;
    report.issues.push({ accountId: String(account.account_id), email: maskEmail(email), reason: 'update_failed' });
  } else {
    report.updated += 1;
  }
}

console.log(JSON.stringify(report, null, 2));
if (report.failed > 0) process.exitCode = 1;
