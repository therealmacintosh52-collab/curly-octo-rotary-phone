/* Copy to sh-config.js and fill in, then deploy.
   Both values are from Supabase -> Project Settings -> API.
   The anon key is PUBLIC by design: Row Level Security lets it INSERT a
   submission and read nothing at all. NEVER put the service_role key here. */
window.SH_CONFIG = {
  url:     'https://YOUR-PROJECT.supabase.co',
  anonKey: 'YOUR-ANON-KEY'
};
