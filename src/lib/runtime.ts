export type RuntimeMode = 'tauri-sqlite' | 'web-supabase';

export interface RuntimeInfo {
  isTauri: boolean;
  isWeb: boolean;
  isCloudflare: boolean;
  mode: RuntimeMode;
  appHost: string;
  platformLabel: string;
  storageLabel: string;
  canUseNativeWindow: boolean;
}

type TauriRuntimeShape = {
  invoke?: unknown;
  metadata?: {
    currentWindow?: {
      label?: string;
    };
  } | unknown;
};

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriRuntimeShape | unknown;
  }
}

function hasTauriInvoke(): boolean {
  const internals = window.__TAURI_INTERNALS__ as TauriRuntimeShape | undefined;
  return Boolean(internals && typeof internals.invoke === 'function');
}

export function hasTauriWindowMetadata(): boolean {
  const internals = window.__TAURI_INTERNALS__ as TauriRuntimeShape | undefined;
  const metadata = internals?.metadata as TauriRuntimeShape['metadata'];
  return Boolean(
    metadata &&
    typeof metadata === 'object' &&
    'currentWindow' in metadata &&
    (metadata as { currentWindow?: { label?: string } }).currentWindow?.label,
  );
}

export function getRuntimeInfo(): RuntimeInfo {
  const isTauri = hasTauriInvoke();
  const host = window.location.hostname || 'localhost';
  const isCloudflare = host.includes('workers.dev') || host.includes('pages.dev');
  const mode: RuntimeMode = isTauri ? 'tauri-sqlite' : 'web-supabase';

  return {
    isTauri,
    isWeb: !isTauri,
    isCloudflare,
    mode,
    appHost: host,
    platformLabel: isTauri ? 'PC/Tauri local' : isCloudflare ? 'Cloudflare/Web' : 'Navegador/Web',
    storageLabel: isTauri ? 'SQLite local offline' : 'Supabase web/mobile',
    canUseNativeWindow: isTauri && hasTauriWindowMetadata(),
  };
}

export function isTauriRuntime(): boolean {
  return getRuntimeInfo().isTauri;
}

export function createWebModeError(): Error {
  return new Error('Este modulo ainda depende do SQLite local via Tauri. No navegador, use o Diagnostico Web e migre este modulo para Supabase antes de operar dados reais.');
}
