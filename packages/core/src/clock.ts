import { STOP_CLOCK_MS } from './constants';

/** Stop the clock: drop the remaining time to 10 seconds, but never add time. */
export function applyStopClock(endsAt: number, now: number): number {
  return Math.min(endsAt, now + STOP_CLOCK_MS);
}

/** Whole seconds left, for display. Never negative. */
export function secondsLeft(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
