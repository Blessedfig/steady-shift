// Owner Desk connection settings.
// Both values come from Supabase: Project Settings > API (or "API Keys").
// The publishable / anon key is designed to be public. The database rules in setup.sql
// are what keep the desk private, so never put the "service_role" or "secret" key here.
window.DESK_CONFIG = {
  supabaseUrl: "",   // e.g. "https://abcdefghijkl.supabase.co"
  supabaseKey: ""    // the publishable key (sb_publishable_...) or the legacy "anon" key
};
