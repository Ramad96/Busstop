import { useEffect, useState } from 'react';
import { standings, winners, type GameState } from '@busstop/core';
import { Avatar } from '../components/Avatar';
import { ErrorText } from '../components/ErrorText';
import { celebrate } from '../fx/confetti';
import { sfx } from '../fx/sound';
import { game } from '../net/socket';

const PLACES = ['🥇', '🥈', '🥉'];

/** End of the line: podium plus a round-by-round breakdown. */
export function Final({ state, you }: { state: GameState; you: string | null }) {
  const isHost = state.hostId === you;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const playersById = new Map(state.players.map((p) => [p.id, p]));
  const totals = Object.fromEntries(
    Object.entries(state.totals).filter(([id]) => playersById.has(id)),
  );
  const table = standings(totals);
  const champs = winners(totals);
  const youWin = !!you && champs.includes(you);
  const podium = table.filter((s) => s.rank <= 3);

  useEffect(() => {
    celebrate(true);
    if (youWin) sfx.fanfare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function playAgain() {
    setBusy(true);
    setError(null);
    const r = await game.newGame();
    setBusy(false);
    if (!r.ok) setError(r.error.message);
  }

  const champNames = champs.map((id) => playersById.get(id)?.name ?? '?');

  return (
    <div className="screen final">
      <button className="btn-link back" onClick={() => game.leaveRoom()}>
        ← Leave
      </button>
      <header className="final-header">
        <p className="kicker">End of the line</p>
        <h2>
          {champNames.length === 1
            ? `${champNames[0]} wins!`
            : `It's a tie: ${champNames.join(' & ')}`}
        </h2>
        {youWin && <p className="caller">That's you! 🎉</p>}
      </header>

      <ol className="podium">
        {podium.map((s) => {
          const p = playersById.get(s.playerId)!;
          return (
            <li key={s.playerId} className={`place-${s.rank}`}>
              <span className="place">{PLACES[s.rank - 1]}</span>
              <Avatar character={p.character} size="lg" />
              <span className="podium-name">
                {p.name}
                {p.id === you && <span className="tag">you</span>}
              </span>
              <span className="podium-score">{s.total}</span>
            </li>
          );
        })}
      </ol>

      <section>
        <h3>Round by round</h3>
        <div className="table-scroll">
          <table className="breakdown">
            <thead>
              <tr>
                <th scope="col">Player</th>
                {state.history.map((h) => (
                  <th key={h.number} scope="col" title={`Round ${h.number}`}>
                    {h.letter}
                  </th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {table.map((s) => (
                <tr key={s.playerId} className={s.rank === 1 ? 'leader' : ''}>
                  <th scope="row">{playersById.get(s.playerId)!.name}</th>
                  {state.history.map((h) => (
                    <td key={h.number}>
                      {h.roundTotals[s.playerId] ?? '–'}
                      {h.stoppedBy === s.playerId && (
                        <span className="busstop-mark" title="Called BUSSTOP!">
                          🚏
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="total">{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint left">🚏 = called BUSSTOP! that round</p>
      </section>

      <ErrorText message={error} />

      <div className="sticky-footer">
        {isHost ? (
          <button className="btn btn-primary btn-big" disabled={busy} onClick={playAgain}>
            Play again
          </button>
        ) : (
          <p className="waiting">Waiting for the host to start a new game…</p>
        )}
      </div>
    </div>
  );
}
