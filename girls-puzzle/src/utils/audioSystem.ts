/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

// Low-volume sine-wave oscillator chimes for a "Zen" aesthetic
export function playZenChime(frequency: number, type: OscillatorType = 'sine', duration = 0.3, volume = 0.1) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    // Resume context if suspended
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Smooth gain envelope (Zen atmosphere)
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn('Audio synthesis failed', e);
  }
}

// Play cozy woody click on block selection
export function playClickSound(enabled: boolean) {
  if (!enabled) return;
  // Two small fast ticks
  playZenChime(800, 'triangle', 0.05, 0.08);
}

// Play sliding swoop on block swap
export function playSwapSound(enabled: boolean) {
  if (!enabled) return;
  // Sweep frequency down
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.2);

    gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    playZenChime(220, 'sine', 0.2, 0.05);
  }
}

// Play beautiful harp-like chord on victory
export function playVictoryChords(enabled: boolean) {
  if (!enabled) return;
  const now = typeof window !== 'undefined' ? getAudioContext()?.currentTime || 0 : 0;
  const baseFreqs = [261.63, 329.63, 392.00, 523.25, 659.25]; // C major pentatonic chord
  
  baseFreqs.forEach((freq, idx) => {
    setTimeout(() => {
      playZenChime(freq, 'sine', 1.2, 0.06);
    }, idx * 120);
  });
}

// Play minor hum on failing
export function playFailureChord(enabled: boolean) {
  if (!enabled) return;
  playZenChime(150, 'sawtooth', 0.6, 0.04);
  setTimeout(() => {
    playZenChime(110, 'sine', 0.8, 0.06);
  }, 100);
}

// Trigger safe tactile vibration
export function triggerVibration(enabled: boolean, ms = 40) {
  if (!enabled) return;
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  } catch (e) {
    // Slently ignore if denied or unsupported
  }
}
