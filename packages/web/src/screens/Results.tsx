import { useEffect, useState } from 'react';
import {
  challengeVoters,
  findChallenge,
  standings,
  winners,
  type CategoryScore,
  type Challenge,
  type GameState,
  type Player,
} from '@letter-race/core';
import { Avatar } from '../components/Avatar';
import { ErrorText } from '../components/ErrorText';
import { celebrate } from '../fx/confetti';
import { sfx } from '../fx/sound';
import { game } from '../net/socket';

type Run = (action: () => Promise<{ ok: boolean; error?: { message: string } }>) => void;

function scoreClass(score: CategoryScore): string {
  if (!score.valid) return 'invalid';
  return score.sharedWith === 1 ? 'unique' : 'shared';
}

function scoreNote(score: CategoryScore): string {
  if (score.rejected) return 'thrown out';
  if (!score.valid) return score.answer.trim() ? 'wrong letter' : 'blank';
  return score.sharedWith === 1 ? 'unique' : `shared ×${score.sharedWith}`;
}

export function Results({ state, you }: { state: GameState; you: string | null }) {
  const round = state.round!;
  const result = round.result!;
  const isHost = state.hostId === you;
  const isLastRound = round.number >= state.settings.totalRounds;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const playersById = new Map(state.players.map((p) => [p.id, p]));
  const nameOf = (id: string) => playersById.get(id)?.name ?? 'Someone';
  // Only players still in the game appear in the standings.
  const totals = Object.fromEntries(
    Object.entries(state.totals).filter(([id]) => playersById.has(id)),
  );
  const table = standings(totals);
  const leaders = winners(totals);
  const participants = table
    .map((s) => s.playerId)
    .filter((id) => result.scores[id])
    .concat(Object.keys(result.scores).filter((id) => !playersById.has(id)));

  const youLead = !!you && leaders.includes(you);
  // Celebrate once per round (not again when challenges change the scores).
  useEffect(() => {
    celebrate(youLead);
    if (youLead) sfx.fanfare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.number]);

  const canChallenge = !!you && round.participants.includes(you);
  const pending = round.challenges.filter((c) => c.outcome === 'pending');

  const run: Run = async (action) => {
    setBusy(true);
    setError(null);
    const r = await action();
    setBusy(false);
    if (!r.ok) setError(r.error?.message ?? 'Something went wrong');
  };

  return (
    <div className="screen results">
      <button className="btn-link back" onClick={() => game.leaveRoom()}>
        ← Leave
      </button>
      <header className="results-header">
        <div className="round-letter">{round.letter}</div>
        <div>
          <p className="kicker">
            Round {round.number} of {state.settings.totalRounds}
          </p>
          <h2>{isLastRound ? 'Last stop!' : 'Round results'}</h2>
          <p className="caller">
            {round.stoppedBy
              ? `🚏 ${nameOf(round.stoppedBy)} called BUSSTOP!`
              : '⏱ Nobody called BUSSTOP! – time ran out'}
          </p>
        </div>
      </header>

      {pending.length > 0 && (
        <section className="challenges">
          {pending.map((c) => (
            <ChallengeCard
              key={`${c.targetId}-${c.category}`}
              state={state}
              challenge={c}
              you={you}
              nameOf={nameOf}
              run={run}
            />
          ))}
        </section>
      )}

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
                  {p.id === round.stoppedBy && (
                    <span className="tag busstop" title="Called BUSSTOP!">
                      🚏
                    </span>
                  )}
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
        {canChallenge && (
          <p className="hint left">Think an answer's made up? Tap 🚩 to challenge it.</p>
        )}
        {result.categories.map((category) => (
          <div key={category} className="category-card">
            <h4>{category}</h4>
            <ul>
              {participants.map((id) => {
                const score = result.scores[id]?.[category];
                if (!score) return null;
                const challenge = findChallenge(round.challenges, id, category);
                return (
                  <li key={id} className={scoreClass(score)}>
                    <span className="who">{playersById.get(id)?.name ?? 'Left'}</span>
                    <span className="what">
                      <span className="answer-text">{score.answer || '—'}</span>
                      <span className="note">
                        {scoreNote(score)}
                        {challenge && <ChallengeBadge challenge={challenge} />}
                      </span>
                    </span>
                    {canChallenge && id !== you && score.valid && !challenge && (
                      <button
                        type="button"
                        className="challenge-btn"
                        aria-label={`Challenge ${playersById.get(id)?.name}'s ${category}`}
                        disabled={busy}
                        onClick={() => run(() => game.challenge(id, category))}
                      >
                        🚩
                      </button>
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
          isLastRound ? (
            <button
              className="btn btn-primary btn-big"
              disabled={busy}
              onClick={() => run(() => game.endGame())}
            >
              🏁 Final scores
            </button>
          ) : (
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
                Next round →
              </button>
            </div>
          )
        ) : (
          <p className="waiting">
            {isLastRound ? 'Waiting for the final scores…' : 'Waiting for the next round…'}
          </p>
        )}
      </div>
    </div>
  );
}

function ChallengeBadge({ challenge }: { challenge: Challenge }) {
  if (challenge.outcome === 'stands')
    return <span className="badge stands"> · ✓ challenge failed</span>;
  if (challenge.outcome === 'rejected') return null;
  return <span className="badge pending"> · 🚩 challenged</span>;
}

function ChallengeCard({
  state,
  challenge,
  you,
  nameOf,
  run,
}: {
  state: GameState;
  challenge: Challenge;
  you: string | null;
  nameOf: (id: string) => string;
  run: Run;
}) {
  const voters = challengeVoters(state, challenge);
  const answer = state.round!.result!.scores[challenge.targetId]?.[challenge.category]?.answer;
  const myVote = you ? challenge.votes[you] : undefined;
  const canVote = !!you && voters.includes(you);
  const count = (v: 'valid' | 'invalid') => voters.filter((id) => challenge.votes[id] === v).length;
  const vote = (verdict: 'valid' | 'invalid') =>
    run(() => game.voteChallenge(challenge.targetId, challenge.category, verdict));
  const target: Player | undefined = state.players.find((p) => p.id === challenge.targetId);

  return (
    <div className="challenge-card" role="group" aria-label="Challenge">
      <p className="challenge-text">
        🚩 <strong>{nameOf(challenge.challengerId)}</strong> challenged{' '}
        <strong>{target?.id === you ? 'your' : `${nameOf(challenge.targetId)}'s`}</strong>{' '}
        {challenge.category.toLowerCase()}:
      </p>
      <p className="challenge-answer">“{answer}”</p>
      {canVote ? (
        <div className="button-row">
          <button
            type="button"
            className={`btn vote-btn valid ${myVote === 'valid' ? 'picked' : ''}`}
            onClick={() => vote('valid')}
          >
            ✓ Fair enough <span className="vote-count">{count('valid')}</span>
          </button>
          <button
            type="button"
            className={`btn vote-btn invalid ${myVote === 'invalid' ? 'picked' : ''}`}
            onClick={() => vote('invalid')}
          >
            ✗ Not having it <span className="vote-count">{count('invalid')}</span>
          </button>
        </div>
      ) : (
        <p className="muted small">
          {target?.id === you ? 'Everyone else is voting…' : 'Waiting for votes…'} ✓{' '}
          {count('valid')} · ✗ {count('invalid')}
        </p>
      )}
    </div>
  );
}
