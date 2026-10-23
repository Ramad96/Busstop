import { useEffect } from 'react';

const STOPS: { title: string; body: string }[] = [
  {
    title: 'Get on board',
    body: 'One person starts a game and shares the 4-letter code. Everyone else hops on with it.',
  },
  {
    title: 'Here comes your letter',
    body: 'The bus pulls in showing a letter. Everyone gets the same one.',
  },
  {
    title: 'Fill every category',
    body: 'Write one answer per category, all starting with that letter. A leading "The" doesn\'t count – The Gap is a G.',
  },
  {
    title: 'BUSSTOP!',
    body: 'Got them all? Hit BUSSTOP! and everyone else has 10 seconds left. You get the 🚏 for that round.',
  },
  {
    title: 'Scores',
    body: 'Only you said it: 10. Shared with one other: 5. Three of you: 3. Four or more: 2. Blank or wrong letter: 0.',
  },
  {
    title: 'Challenge it',
    body: "Think someone's made one up? Tap 🚩 on their answer. If most of the others agree, it scores 0. Challenging never costs you points.",
  },
  {
    title: 'End of the line',
    body: 'After the last round (3 by default), the most points wins.',
  },
];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="howto-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 id="howto-title">How to play</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <ol className="route">
          {STOPS.map((s, i) => (
            <li key={s.title} className="route-stop">
              <span className="route-dot" aria-hidden>
                {i + 1}
              </span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <button className="btn btn-primary btn-big" onClick={onClose}>
          Got it – let's go
        </button>
      </div>
    </div>
  );
}
