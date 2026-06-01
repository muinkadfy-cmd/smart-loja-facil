export interface PublicWebEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseAnonKeyName: string;
  hasSupabaseUrl: boolean;
  hasSupabaseAnonKey: boolean;
  hasUnsafeServiceRoleKey: boolean;
  isConfigured: boolean;
  missing: string[];
  securityWarnings: string[];
}

function cleanEnvValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstConfiguredEnv(metaEnv: Record<string, unknown> | undefined, names: string[]): { value: string; name: string } {
  for (const name of names) {
    const value = cleanEnvValue(metaEnv?.[name]);
    if (value) return { value, name };
  }
  return { value: '', name: names[0] ?? '' };
}

export function getPublicWebEnv(): PublicWebEnv {
  const metaEnv = import.meta as ImportMeta & { env?: Record<string, unknown> };
  const envEntries = Object.entries(metaEnv.env ?? {});
  const supabaseUrl = cleanEnvValue(metaEnv.env?.VITE_SUPABASE_URL);
  const anonKey = firstConfiguredEnv(metaEnv.env, [
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
  ]);
  const missing: string[] = [];
  const unsafeServiceRoleNames = envEntries
    .map(([name]) => name)
    .filter((name) => /SUPABASE.*SERVICE.*ROLE|SERVICE.*ROLE.*SUPABASE|SERVICE_ROLE/i.test(name));
  const securityWarnings: string[] = [];

  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!anonKey.value) missing.push('VITE_SUPABASE_ANON_KEY ou VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY');
  if (unsafeServiceRoleNames.length > 0) {
    securityWarnings.push(`Remova ${unsafeServiceRoleNames.join(', ')} do frontend. Service role nunca pode ir para PWA/Web.`);
  }

  return {
    supabaseUrl,
    supabaseAnonKey: anonKey.value,
    supabaseAnonKeyName: anonKey.name,
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasSupabaseAnonKey: Boolean(anonKey.value),
    hasUnsafeServiceRoleKey: unsafeServiceRoleNames.length > 0,
    isConfigured: missing.length === 0 && unsafeServiceRoleNames.length === 0,
    missing,
    securityWarnings,
  };
}
