export function Home({ onHost, onJoin }: { onHost: () => void; onJoin: () => void }) {
  return (
    <div className="screen home">
      <div className="logo">
        <span className="logo-hat">🎩</span>
        <h1>
          Letter <span>Race</span>
        </h1>
        <p className="tagline">One letter. Six categories. Beat the clock.</p>
      </div>
      <div className="stack">
        <button className="btn btn-primary btn-big" onClick={onHost}>
          Host game
        </button>
        <button className="btn btn-secondary btn-big" onClick={onJoin}>
          Join game
        </button>
      </div>
    </div>
  );
}
