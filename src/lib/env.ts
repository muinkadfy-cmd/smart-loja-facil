/// <reference types="vite/client" />

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

type PublicViteEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SERVICE_ROLE_KEY?: string;
};

const viteEnv = import.meta.env as unknown as PublicViteEnv;

function firstConfiguredEnv(names: Array<keyof PublicViteEnv>): { value: string; name: string } {
  for (const name of names) {
    const value = cleanEnvValue(viteEnv[name]);
    if (value) return { value, name };
  }
  return { value: '', name: String(names[0] ?? '') };
}

export function getPublicWebEnv(): PublicWebEnv {
  const supabaseUrl = cleanEnvValue(viteEnv.VITE_SUPABASE_URL);
  const anonKey = firstConfiguredEnv([
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
  ]);

  const unsafeServiceRoleNames = [
    ['VITE_SUPABASE_SERVICE_ROLE_KEY', viteEnv.VITE_SUPABASE_SERVICE_ROLE_KEY],
    ['VITE_SERVICE_ROLE_KEY', viteEnv.VITE_SERVICE_ROLE_KEY],
  ]
    .filter(([, value]) => Boolean(cleanEnvValue(value)))
    .map(([name]) => name);

  const missing: string[] = [];
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
