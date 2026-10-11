import { describe, expect, it } from 'vitest';
import { bestOffset, offsetFromSample } from './clock';

describe('clock sync', () => {
  it('assumes the reply took half the round trip', () => {
    // Sent at 1000, got back at 1100; server said 5050 → server is 4000 ahead.
    expect(offsetFromSample({ sentAt: 1000, receivedAt: 1100, serverNow: 5050 })).toBe(4000);
  });

  it('picks the fastest sample', () => {
    expect(
      bestOffset([
        { sentAt: 0, receivedAt: 400, serverNow: 1000 },
        { sentAt: 0, receivedAt: 20, serverNow: 1010 },
      ]),
    ).toBe(1000);
    expect(bestOffset([])).toBeNull();
  });
});
