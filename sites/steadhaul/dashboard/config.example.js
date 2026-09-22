/* Copy to config.js and fill in. Both values come from
   Supabase → Project Settings → API.
   The anon key is PUBLIC by design — Row Level Security protects the data.
   NEVER put the service_role key here; it bypasses every policy. */
window.SH_CONFIG = {
  url:     'https://YOUR-PROJECT.supabase.co',
  anonKey: 'YOUR-ANON-KEY'
};
