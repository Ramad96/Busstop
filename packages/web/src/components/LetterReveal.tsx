import { allowedLetters, REVEAL_MS, type Settings } from '@letter-race/core';
import { useServerNow } from '../hooks';

/**
 * Letter coming out of a hat. Driven by the server's revealEndsAt so every device
 * shows the same frame at the same moment (and a refresh lands mid-animation).
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
  const now = useServerNow(60);
  const elapsed = Math.max(0, REVEAL_MS - (revealEndsAt - now));
  const landed = elapsed >= REVEAL_MS * 0.7;
  const pool = allowedLetters(settings);
  // Shuffle through letters, slowing down, then land on the real one.
  const step = Math.floor(Math.pow(elapsed / 40, 0.8));
  const shown = landed ? letter : pool[(step * 7) % pool.length];

  return (
    <div className="screen center reveal">
      <p className="muted reveal-caption">{landed ? 'Your letter is…' : 'Shaking the hat…'}</p>
      <div className={`hat ${landed ? 'done' : 'shaking'}`}>🎩</div>
      <div key={landed ? 'final' : 'spin'} className={`reveal-letter ${landed ? 'landed' : ''}`}>
        {shown}
      </div>
    </div>
  );
}
