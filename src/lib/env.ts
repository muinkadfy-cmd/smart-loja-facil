export interface PublicWebEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  hasSupabaseUrl: boolean;
  hasSupabaseAnonKey: boolean;
  isConfigured: boolean;
  missing: string[];
}

function cleanEnvValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getPublicWebEnv(): PublicWebEnv {
  const metaEnv = import.meta as ImportMeta & { env?: Record<string, unknown> };
  const supabaseUrl = cleanEnvValue(metaEnv.env?.VITE_SUPABASE_URL);
  const supabaseAnonKey = cleanEnvValue(metaEnv.env?.VITE_SUPABASE_ANON_KEY);
  const missing: string[] = [];

  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');

  return {
    supabaseUrl,
    supabaseAnonKey,
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasSupabaseAnonKey: Boolean(supabaseAnonKey),
    isConfigured: missing.length === 0,
    missing,
  };
}
