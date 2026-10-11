import { describe, expect, it } from 'vitest';
import { applyStopClock, secondsLeft } from './clock';

describe('applyStopClock', () => {
  it('drops the timer to 10 seconds when more than 10 are left', () => {
    expect(applyStopClock(100_000, 30_000)).toBe(40_000);
  });

  it('does nothing when 10 seconds or fewer are left', () => {
    expect(applyStopClock(100_000, 95_000)).toBe(100_000);
    expect(applyStopClock(100_000, 90_000)).toBe(100_000);
  });
});

describe('secondsLeft', () => {
  it('rounds up and never goes negative', () => {
    expect(secondsLeft(10_000, 0)).toBe(10);
    expect(secondsLeft(10_000, 500)).toBe(10);
    expect(secondsLeft(10_000, 9_001)).toBe(1);
    expect(secondsLeft(10_000, 10_000)).toBe(0);
    expect(secondsLeft(10_000, 20_000)).toBe(0);
  });
});
