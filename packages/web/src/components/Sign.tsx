/** The Busstop roundel: red ring with a white name bar, like a bus stop flag. */
export function BusStopSign({
  size = 'md',
  text = 'BUSSTOP',
}: {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}) {
  return (
    <div className={`roundel roundel-${size}`} role="img" aria-label={text}>
      <span className="roundel-bar">{text}</span>
    </div>
  );
}

/** The round's letter on a stop flag. */
export function LetterSign({ letter, size = 'md' }: { letter: string; size?: 'md' | 'lg' }) {
  return (
    <div className={`letter-sign letter-sign-${size} round-letter`} aria-label={`Letter ${letter}`}>
      <span>{letter}</span>
    </div>
  );
}
