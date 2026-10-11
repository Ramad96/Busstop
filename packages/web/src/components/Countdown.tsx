import { secondsLeft } from '@letter-race/core';
import { formatSeconds } from '../util';

export function Countdown({ endsAt, now }: { endsAt: number; now: number }) {
  const left = secondsLeft(endsAt, now);
  const urgent = left <= 10;
  return (
    <div className={`countdown ${urgent ? 'urgent' : ''}`} role="timer" aria-live="off">
      {formatSeconds(left)}
    </div>
  );
}
