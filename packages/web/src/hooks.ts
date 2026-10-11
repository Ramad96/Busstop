import { useEffect, useState } from 'react';
import { game } from './net/socket';

/** Server time, re-rendering every `intervalMs`. */
export function useServerNow(intervalMs = 200): number {
  const [now, setNow] = useState(() => game.serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(game.serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
