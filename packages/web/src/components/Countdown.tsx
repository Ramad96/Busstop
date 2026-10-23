import { secondsLeft } from '@letter-race/core';
import { formatSeconds } from '../util';
import { DotMatrix } from './DotMatrix';

/** Departure-board countdown. */
export function Countdown({ endsAt, now }: { endsAt: number; now: number }) {
  const left = secondsLeft(endsAt, now);
  const urgent = left <= 10;
  return (
    <DotMatrix className={`countdown ${urgent ? 'urgent' : ''}`}>
      <span className="dm-label">{left === 0 ? 'DUE' : 'DUE IN'}</span>
      <span className="dm-time" role="timer" aria-live="off">
        {left === 0 ? 'NOW' : formatSeconds(left)}
      </span>
    </DotMatrix>
  );
}
