export interface ClockSample {
  /** Local time the ping was sent. */
  sentAt: number;
  /** Local time the reply arrived. */
  receivedAt: number;
  serverNow: number;
}

/** Offset to add to Date.now() to get server time, assuming the reply took half the round trip. */
export function offsetFromSample(sample: ClockSample): number {
  const rtt = sample.receivedAt - sample.sentAt;
  return sample.serverNow + rtt / 2 - sample.receivedAt;
}

/** Uses the sample with the shortest round trip – it has the least network noise. */
export function bestOffset(samples: ClockSample[]): number | null {
  if (samples.length === 0) return null;
  const best = samples.reduce((a, b) =>
    b.receivedAt - b.sentAt < a.receivedAt - a.sentAt ? b : a,
  );
  return offsetFromSample(best);
}
