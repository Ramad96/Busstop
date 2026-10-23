import { DotMatrix } from '../components/DotMatrix';
import { BusStopSign } from '../components/Sign';

export function Home({
  onHost,
  onJoin,
  onHowTo,
}: {
  onHost: () => void;
  onJoin: () => void;
  onHowTo: () => void;
}) {
  return (
    <div className="screen home">
      <div className="home-hero">
        <div className="stop-post">
          <BusStopSign size="lg" />
          <div className="pole" aria-hidden />
        </div>
        <DotMatrix
          className="home-board marquee"
          label="One letter. Every category. Beat the clock."
        >
          <span className="marquee-track" aria-hidden>
            ONE LETTER · EVERY CATEGORY · BEAT THE CLOCK · ONE LETTER · EVERY CATEGORY · BEAT THE
            CLOCK ·
          </span>
        </DotMatrix>
      </div>
      <div className="stack">
        <button className="btn btn-primary btn-big" onClick={onHost}>
          🚌 Start a game
        </button>
        <button className="btn btn-secondary btn-big" onClick={onJoin}>
          🚏 Join a game
        </button>
        <button className="btn btn-ghost" onClick={onHowTo}>
          How to play
        </button>
      </div>
      <div className="home-road" aria-hidden>
        <span className="home-bus">🚌</span>
      </div>
    </div>
  );
}
