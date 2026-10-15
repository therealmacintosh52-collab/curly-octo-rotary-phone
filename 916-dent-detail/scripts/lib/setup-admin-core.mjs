// Core of `npm run setup:admin` (injectable client so it is unit tested without Supabase).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function parseArgs(argv) {
  const out = { email: '', name: '', password: '', role: 'owner', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const take = () => { const eq = a.indexOf('='); if (eq > -1) return a.slice(eq + 1); return argv[++i] ?? ''; };
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--email')) out.email = take().trim().toLowerCase();
    else if (a.startsWith('--name')) out.name = take().trim();
    else if (a.startsWith('--password')) out.password = take();
    else if (a.startsWith('--role')) out.role = take().trim();
  }
  return out;
}

export function validate(o) {
  const errs = [];
  if (!EMAIL_RE.test(o.email)) errs.push('--email is required and must be a valid address');
  if (!['owner', 'admin'].includes(o.role)) errs.push('--role must be owner or admin');
  if (o.password && o.password.length < 12) errs.push('--password must be at least 12 characters (or omit it and sign in with the magic link)');
  return errs;
}

export const isLive = (env) => Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

export function demoInstructions() {
  return [
    'Mock mode (no Supabase keys): there is no account to create.',
    '  Open /admin/login and use the DEMO buttons (Owner, Tech One, Tech Two).',
    '  In a PRODUCTION build the demo buttons need ADMIN_DEMO_LOGIN=1 (and are ignored whenever Supabase is configured).',
    '  For the real site: fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in .env.local and run this again.',
  ];
}

/** Find an auth user by email (listUsers is paged; the owner list is tiny). */
export async function findUser(client, email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

export async function runSetup(o, { client, env }) {
  const log = [];
  const errs = validate(o);
  if (errs.length) return { ok: false, log: errs.map((e) => `error: ${e}`) };
  if (!isLive(env)) return { ok: true, mode: 'mock', log: demoInstructions() };
  if (o.dryRun) return { ok: true, mode: 'dry-run', log: [`dry run: would ensure an auth user for ${o.email}, set profiles.role=${o.role}${o.password ? ', and set the given password' : ''}. Nothing was changed.`] };

  let user = await findUser(client, o.email);
  if (!user) {
    const { data, error } = await client.auth.admin.createUser({ email: o.email, email_confirm: true, ...(o.password ? { password: o.password } : {}) });
    if (error || !data?.user) return { ok: false, log: [`error: could not create the user: ${error?.message ?? 'unknown'}`] };
    user = data.user;
    log.push(`created auth user ${o.email} (${user.id})`);
  } else {
    log.push(`auth user ${o.email} already exists (${user.id})`);
    if (o.password) {
      const { error } = await client.auth.admin.updateUserById(user.id, { password: o.password });
      if (error) return { ok: false, log: [...log, `error: could not set the password: ${error.message}`] };
      log.push('password updated');
    }
  }
  const { error: pe } = await client.from('profiles').upsert({ id: user.id, role: o.role, full_name: o.name || o.email.split('@')[0] }, { onConflict: 'id' });
  if (pe) return { ok: false, log: [...log, `error: could not write the profile (did you run supabase/migrations/0001_init.sql?): ${pe.message}`] };
  log.push(`profile ${user.id} has role ${o.role}`);
  log.push('', `Sign in at /admin/login with ${o.password ? 'the password you set, or ' : ''}the "Email me a sign-in link" option for ${o.email}.`,
    'Add <your-site>/admin/auth/callback to Supabase > Authentication > URL Configuration > Redirect URLs first, or the link will not work.');
  return { ok: true, mode: 'live', userId: user.id, log };
}
