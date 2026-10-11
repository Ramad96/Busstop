import { useEffect, useState } from 'react';
import { standings, winners, type CategoryScore, type GameState } from '@letter-race/core';
import { Avatar } from '../components/Avatar';
import { ErrorText } from '../components/ErrorText';
import { celebrate } from '../fx/confetti';
import { sfx } from '../fx/sound';
import { game } from '../net/socket';

function scoreClass(score: CategoryScore): string {
  if (!score.valid) return 'invalid';
  return score.sharedWith === 1 ? 'unique' : 'shared';
}

function scoreNote(score: CategoryScore): string {
  if (score.rejected) return 'rejected';
  if (!score.valid) return score.answer.trim() ? 'wrong letter' : 'blank';
  return score.sharedWith === 1 ? 'unique' : `shared ×${score.sharedWith}`;
}

export function Results({ state, you }: { state: GameState; you: string | null }) {
  const round = state.round!;
  const result = round.result!;
  const isHost = state.hostId === you;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const playersById = new Map(state.players.map((p) => [p.id, p]));
  // Only players still in the game appear in the standings.
  const totals = Object.fromEntries(
    Object.entries(state.totals).filter(([id]) => playersById.has(id)),
  );
  const table = standings(totals);
  const leaders = winners(totals);
  const leaderNames = leaders.map((id) => playersById.get(id)?.name ?? '?');
  const participants = table
    .map((s) => s.playerId)
    .filter((id) => result.scores[id])
    .concat(Object.keys(result.scores).filter((id) => !playersById.has(id)));

  const youLead = !!you && leaders.includes(you);
  // Celebrate once per round (not again when votes change the scores).
  useEffect(() => {
    celebrate(youLead);
    if (youLead) sfx.fanfare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.number]);

  const canVote = !!you && round.participants.includes(you);
  const votesFor = (targetId: string, category: string) =>
    round.votes
      .filter((v) => v.targetId === targetId && v.category === category)
      .map((v) => v.voterId);

  async function run(action: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setBusy(true);
    setError(null);
    const r = await action();
    setBusy(false);
    if (!r.ok) setError(r.error?.message ?? 'Something went wrong');
  }

  return (
    <div className="screen results">
      <button className="btn-link back" onClick={() => game.leaveRoom()}>
        ← Leave
      </button>
      <header className="results-header">
        <div className="round-letter">{round.letter}</div>
        <div>
          <h2>Round {round.number} results</h2>
          <p className="muted">
            {leaders.length === 1
              ? `🏆 ${leaderNames[0]} is winning!`
              : `🏆 Tie: ${leaderNames.join(' & ')}`}
          </p>
        </div>
      </header>

      <section>
        <h3>Scoreboard</h3>
        <ol className="standings">
          {table.map((s) => {
            const p = playersById.get(s.playerId)!;
            const gained = result.roundTotals[s.playerId];
            return (
              <li key={s.playerId} className={s.rank === 1 ? 'leader' : ''}>
                <span className="rank">{s.rank === 1 ? '👑' : s.rank}</span>
                <Avatar character={p.character} size="sm" />
                <span className="player-name">
                  {p.name}
                  {p.id === you && <span className="tag">you</span>}
                </span>
                {gained !== undefined && <span className="gained">+{gained}</span>}
                <span className="total">{s.total}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <h3>Answers</h3>
        <div className="legend">
          <span className="pill unique">unique 10</span>
          <span className="pill shared">shared 5 / 3 / 2</span>
          <span className="pill invalid">0</span>
        </div>
        {canVote && (
          <p className="hint left">Silly answer? Tap 👎 – most players agreeing scores it 0.</p>
        )}
        {result.categories.map((category) => (
          <div key={category} className="category-card">
            <h4>{category}</h4>
            <ul>
              {participants.map((id) => {
                const score = result.scores[id]?.[category];
                if (!score) return null;
                const player = playersById.get(id);
                return (
                  <li key={id} className={scoreClass(score)}>
                    <span className="who">{player?.name ?? 'Left'}</span>
                    <span className="what">
                      <span className="answer-text">{score.answer || '—'}</span>
                      <span className="note">{scoreNote(score)}</span>
                    </span>
                    {canVote && id !== you && (score.valid || score.rejected) && (
                      <VoteButton
                        count={votesFor(id, category).length}
                        mine={votesFor(id, category).includes(you!)}
                        onClick={() => run(() => game.voteReject(id, category))}
                      />
                    )}
                    <span className="points">{score.points}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <ErrorText message={error} />

      <div className="sticky-footer">
        {isHost ? (
          <div className="button-row">
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => run(() => game.endGame())}
            >
              End game
            </button>
            <button
              className="btn btn-primary grow"
              disabled={busy}
              onClick={() => run(() => game.startGame())}
            >
              Next round
            </button>
          </div>
        ) : (
          <p className="waiting">Waiting for the host…</p>
        )}
      </div>
    </div>
  );
}

function VoteButton({
  count,
  mine,
  onClick,
}: {
  count: number;
  mine: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`vote ${mine ? 'mine' : ''}`}
      aria-pressed={mine}
      aria-label={mine ? 'Take back reject vote' : 'Vote to reject'}
      onClick={onClick}
    >
      👎{count > 0 && <span>{count}</span>}
    </button>
  );
}
