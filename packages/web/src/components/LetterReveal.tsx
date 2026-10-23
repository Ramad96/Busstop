import { useEffect } from 'react';
import { allowedLetters, REVEAL_MS, type Settings } from '@busstop/core';
import { sfx } from '../fx/sound';
import { useServerNow } from '../hooks';
import { DotMatrix } from './DotMatrix';
import { LetterSign } from './Sign';

/**
 * The bus pulls in with the letter on its destination blind. Driven by the server's
 * revealEndsAt so every device shows the same frame (and a refresh lands mid-way).
 */
export function LetterReveal({
  letter,
  revealEndsAt,
  settings,
}: {
  letter: string;
  revealEndsAt: number;
  settings: Settings;
}) {
  const now = useServerNow(50);
  const elapsed = Math.max(0, REVEAL_MS - (revealEndsAt - now));
  const progress = Math.min(1, elapsed / (REVEAL_MS * 0.65));
  const landed = elapsed >= REVEAL_MS * 0.7;
  const pool = allowedLetters(settings);
  // The blind flicks through letters, slowing down, then lands on the real one.
  const step = Math.floor(Math.pow(elapsed / 40, 0.8));
  const shown = landed ? letter : pool[(step * 7) % pool.length];
  // Ease out: the bus slows as it pulls in.
  const busX = (1 - (1 - Math.pow(1 - progress, 3))) * 110;

  useEffect(() => {
    if (landed) sfx.ding();
  }, [landed]);

  return (
    <div className="screen center reveal">
      <DotMatrix className="reveal-blind">
        <span className="dm-label">{landed ? 'THIS ROUND' : 'NEXT LETTER'}</span>
        <span className="dm-big">{shown}</span>
      </DotMatrix>
      <div className="reveal-stage">
        {landed ? (
          <div className="reveal-landed">
            <LetterSign letter={letter} size="lg" />
            <p className="reveal-caption">Ding ding! It's {letter}</p>
          </div>
        ) : (
          <div className="reveal-bus" style={{ transform: `translateX(${busX}vw)` }} aria-hidden>
            🚌
          </div>
        )}
        <div className="road" aria-hidden />
      </div>
    </div>
  );
}
