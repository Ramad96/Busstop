import type { RandomFn } from './types';

/** Deterministic random: returns the given values in order, looping. */
export function seq(...values: number[]): RandomFn {
  let i = 0;
  return () => values[i++ % values.length];
}
