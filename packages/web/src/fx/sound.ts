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

/** A bus bell: a bright strike with a couple of overtones, decaying fast. */
function bell(delayMs = 0) {
  tone(1568, 650, { volume: 0.18, delayMs });
  tone(2350, 420, { volume: 0.07, delayMs });
  tone(3920, 220, { volume: 0.04, delayMs });
}

export const sfx = {
  tick() {
    tone(1000, 60, { type: 'square', volume: 0.08 });
    vibrate(25);
  },
  /** Ding ding – the driver's "off we go". */
  ding() {
    bell();
    bell(260);
    vibrate([40, 80, 40]);
  },
  /** Someone pressed BUSSTOP! */
  stop() {
    bell();
    tone(420, 260, { type: 'square', volume: 0.06, delayMs: 60 });
    vibrate([80, 40, 80]);
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
