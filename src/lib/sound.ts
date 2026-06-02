type SoundKind = 'success' | 'warning' | 'error' | 'click';

const AUDIO_ENABLED_KEY = 'smart-loja-facil:sounds-enabled';
const NOTIFICATION_ENABLED_KEY = 'smart-loja-facil:notifications-enabled';

function readFlag(key: string, defaultValue = true): boolean {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? defaultValue : value === '1';
  } catch {
    return defaultValue;
  }
}

function writeFlag(key: string, enabled: boolean): void {
  try {
    window.localStorage.setItem(key, enabled ? '1' : '0');
  } catch {
    // Preferimos não quebrar operação comercial se o navegador bloquear localStorage.
  }
}

function isAudioEnabled(): boolean {
  return readFlag(AUDIO_ENABLED_KEY, true);
}

export function setOperationSoundsEnabled(enabled: boolean): void {
  writeFlag(AUDIO_ENABLED_KEY, enabled);
}

export function getOperationSoundsEnabled(): boolean {
  return isAudioEnabled();
}

export function setOperationNotificationsEnabled(enabled: boolean): void {
  writeFlag(NOTIFICATION_ENABLED_KEY, enabled);
}

export function getOperationNotificationsEnabled(): boolean {
  return readFlag(NOTIFICATION_ENABLED_KEY, true);
}

export function playOperationSound(kind: SoundKind = 'success'): void {
  if (!isAudioEnabled()) return;
  if (typeof window === 'undefined') return;

  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const ctx = new AudioContextCtor();
    const gain = ctx.createGain();
    const first = ctx.createOscillator();
    const second = ctx.createOscillator();

    const frequencies: Record<SoundKind, [number, number]> = {
      success: [660, 880],
      warning: [440, 620],
      error: [220, 180],
      click: [420, 520],
    };

    const [f1, f2] = frequencies[kind];
    const duration = kind === 'error' ? 0.24 : kind === 'warning' ? 0.18 : 0.15;

    first.type = 'sine';
    second.type = 'triangle';
    first.frequency.value = f1;
    second.frequency.value = f2;

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(kind === 'error' ? 0.05 : 0.032, ctx.currentTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    first.connect(gain);
    second.connect(gain);
    gain.connect(ctx.destination);
    first.start();
    first.stop(ctx.currentTime + duration);
    second.start(ctx.currentTime + 0.035);
    second.stop(ctx.currentTime + duration + 0.035);

    window.setTimeout(() => void ctx.close().catch(() => undefined), 360);
  } catch {
    // Som é conforto de uso, nunca deve travar venda/caixa/crediário.
  }
}
