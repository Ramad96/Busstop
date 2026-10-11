/**
 * Tiny synthesised sound effects (no audio files) plus haptics.
 * Browsers only allow audio after a user gesture, so we unlock on the first tap.
 */
import { useSyncExternalStore } from 'react';
import { storage } from '../net/storage';

const MUTE_KEY = 'letterRace.muted';

let ctx: AudioContext | null = null;
let muted = storage.get(MUTE_KEY) === '1';
const listeners = new Set<() => void>();

function audio(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    audio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function tone(
  freq: number,
  durationMs: number,
  {
    type = 'sine',
    volume = 0.2,
    delayMs = 0,
    slideTo,
  }: {
    type?: OscillatorType;
    volume?: number;
    delayMs?: number;
    slideTo?: number;
  } = {},
) {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + delayMs / 1000;
  const end = start + durationMs / 1000;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, end);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

export function vibrate(pattern: number | number[]) {
  if (muted) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported (e.g. iOS Safari).
  }
}

export const sfx = {
  tick() {
    tone(1000, 60, { type: 'square', volume: 0.08 });
    vibrate(25);
  },
  ding() {
    tone(880, 180, { volume: 0.2 });
    tone(1320, 320, { volume: 0.15, delayMs: 120 });
    vibrate(40);
  },
  stop() {
    tone(660, 120, { type: 'triangle', volume: 0.2 });
    tone(440, 220, { type: 'triangle', volume: 0.2, delayMs: 120 });
    vibrate([60, 40, 60]);
  },
  timeUp() {
    tone(300, 500, { type: 'sawtooth', volume: 0.12, slideTo: 150 });
    vibrate([120, 60, 120]);
  },
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 220, { volume: 0.15, delayMs: i * 110 }));
    vibrate([40, 30, 40, 30, 80]);
  },
};

export function setMuted(value: boolean) {
  muted = value;
  storage.set(MUTE_KEY, value ? '1' : '0');
  for (const l of listeners) l();
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => muted,
  );
}
