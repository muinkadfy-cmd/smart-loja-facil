type SoundKind = 'success' | 'warning' | 'error' | 'click';

const AUDIO_ENABLED_KEY = 'smart-loja-facil:sounds-enabled';

function isAudioEnabled(): boolean {
  try {
    const value = window.localStorage.getItem(AUDIO_ENABLED_KEY);
    return value === null ? true : value === '1';
  } catch {
    return true;
  }
}

export function setOperationSoundsEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(AUDIO_ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    // Preferimos não quebrar operação comercial se o navegador bloquear localStorage.
  }
}

export function getOperationSoundsEnabled(): boolean {
  return isAudioEnabled();
}

export function playOperationSound(kind: SoundKind = 'success'): void {
  if (!isAudioEnabled()) return;
  if (typeof window === 'undefined') return;

  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    const frequencies: Record<SoundKind, number> = {
      success: 740,
      warning: 520,
      error: 220,
      click: 420,
    };

    oscillator.type = 'sine';
    oscillator.frequency.value = frequencies[kind];
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(kind === 'error' ? 0.055 : 0.035, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === 'error' ? 0.18 : 0.11));

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + (kind === 'error' ? 0.2 : 0.13));

    window.setTimeout(() => void ctx.close().catch(() => undefined), 260);
  } catch {
    // Som é conforto de uso, nunca deve travar venda/caixa/crediário.
  }
}
