import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicWebEnv } from './env';

let cachedClient: SupabaseClient | null = null;

export type WebSessionSummary = {
  email: string;
  userId: string;
  expiresAt: number | null;
};

export function getSupabaseClient(): SupabaseClient | null {
  const env = getPublicWebEnv();
  if (!env.isConfigured) return null;
  if (!cachedClient) {
    cachedClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return cachedClient;
}

export function summarizeSession(session: Session | null): WebSessionSummary | null {
  if (!session?.user) return null;
  return {
    email: session.user.email ?? 'usuario sem e-mail',
    userId: session.user.id,
    expiresAt: session.expires_at ?? null,
  };
}
