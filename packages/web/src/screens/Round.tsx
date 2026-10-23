import { useCallback, useEffect, useRef, useState } from 'react';
import {
  allAnswersValid,
  isValidAnswer,
  MAX_ANSWER_LENGTH,
  secondsLeft,
  STOP_CLOCK_MS,
  type Answers,
  type GameState,
  type Round as RoundState,
} from '@busstop/core';
import { Countdown } from '../components/Countdown';
import { ErrorText } from '../components/ErrorText';
import { LetterReveal } from '../components/LetterReveal';
import { LetterSign } from '../components/Sign';
import { sfx } from '../fx/sound';
import { useServerNow } from '../hooks';
import { game } from '../net/socket';

const SAVE_DELAY_MS = 400;

export function Round({ state, you }: { state: GameState; you: string | null }) {
  const round = state.round!;
  if (state.phase === 'reveal') {
    return (
      <LetterReveal
        letter={round.letter}
        revealEndsAt={round.revealEndsAt}
        settings={state.settings}
      />
    );
  }
  if (!you || !round.participants.includes(you)) return <Watching state={state} round={round} />;
  return <AnswerForm key={round.number} state={state} round={round} you={you} />;
}

function stopperName(state: GameState, round: RoundState): string | null {
  if (!round.stoppedBy) return null;
  return state.players.find((p) => p.id === round.stoppedBy)?.name ?? 'Someone';
}

function Watching({ state, round }: { state: GameState; round: RoundState }) {
  const now = useServerNow();
  return (
    <div className="screen center">
      <LetterSign letter={round.letter} size="lg" />
      <Countdown endsAt={round.endsAt} now={now} />
      <p className="muted">You got on mid-round – you'll play from the next one.</p>
      <button className="btn-link" onClick={() => game.leaveRoom()}>
        Leave game
      </button>
      {state.phase === 'scoring' && <p className="muted">Time's up! Scoring…</p>}
    </div>
  );
}

function AnswerForm({ state, round, you }: { state: GameState; round: RoundState; you: string }) {
  const now = useServerNow();
  // Start from what the server saved, so a refresh mid-round keeps your answers.
  const [answers, setAnswers] = useState<Answers>(() => round.answers[you] ?? {});
  const [error, setError] = useState<string | null>(null);
  const answersRef = useRef(answers);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitted = useRef(round.submitted.includes(you));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const timeUp = state.phase !== 'playing' || now >= round.endsAt;
  const remainingMs = round.endsAt - now;
  const allValid = allAnswersValid(answers, round.categories, round.letter);
  const canStop = allValid && !timeUp && remainingMs > STOP_CLOCK_MS;
  const stopper = stopperName(state, round);
  const filled = round.categories.filter((c) =>
    isValidAnswer(answers[c] ?? '', round.letter),
  ).length;
  const left = secondsLeft(round.endsAt, now);

  // Tick for the last 10 seconds, buzz at zero.
  useEffect(() => {
    if (state.phase !== 'playing') return;
    if (left > 0 && left <= 10) sfx.tick();
    else if (left === 0) sfx.timeUp();
  }, [left, state.phase]);

  useEffect(() => {
    if (round.stoppedBy) sfx.stop();
  }, [round.stoppedBy]);

  const save = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    void game.updateAnswers(answersRef.current);
  }, []);

  function change(category: string, value: string) {
    const next = { ...answersRef.current, [category]: value };
    answersRef.current = next;
    setAnswers(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, SAVE_DELAY_MS);
  }

  // Our clock says time's up: push the latest answers straight away.
  useEffect(() => {
    if (timeUp && state.phase === 'playing' && saveTimer.current) save();
  }, [timeUp, state.phase, save]);

  // Server says answers are locked: send them in automatically.
  useEffect(() => {
    if (state.phase !== 'scoring' || submitted.current) return;
    submitted.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void game.submitAnswers(answersRef.current);
  }, [state.phase]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  async function stop() {
    setError(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const result = await game.stopClock(answersRef.current);
    if (!result.ok) setError(result.error.message);
  }

  return (
    <div className={`screen round ${timeUp ? 'locked' : ''}`}>
      <header className="round-header">
        <LetterSign letter={round.letter} />
        <div className="round-meta">
          <span className="kicker">
            Round {round.number} of {state.settings.totalRounds}
          </span>
          <Countdown endsAt={round.endsAt} now={now} />
        </div>
      </header>

      {stopper && !timeUp && (
        <div className="banner stop-banner" role="status">
          🚏 {stopper} called BUSSTOP! 10 seconds left
        </div>
      )}
      {timeUp && (
        <div className="banner timeup-banner" role="status">
          Time's up! Collecting answers…
        </div>
      )}

      <form className="answers" onSubmit={(e) => e.preventDefault()}>
        {round.categories.map((category, i) => {
          const value = answers[category] ?? '';
          const valid = isValidAnswer(value, round.letter);
          const wrong = value.trim().length > 0 && !valid;
          return (
            <label
              key={category}
              className={`answer ${valid ? 'valid' : ''} ${wrong ? 'wrong' : ''}`}
            >
              <span className="answer-label">{category}</span>
              <span className="answer-row">
                <input
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  value={value}
                  onChange={(e) => change(category, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') inputs.current[i + 1]?.focus();
                  }}
                  disabled={timeUp}
                  maxLength={MAX_ANSWER_LENGTH}
                  placeholder={`${round.letter}…`}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  enterKeyHint={i === round.categories.length - 1 ? 'done' : 'next'}
                  aria-invalid={wrong}
                />
                <span className="answer-mark" aria-hidden>
                  {valid ? '✓' : wrong ? '✗' : ''}
                </span>
              </span>
            </label>
          );
        })}
      </form>

      <ErrorText message={error} />

      <div className="sticky-footer">
        <button className="bell-btn" disabled={!canStop} onClick={stop}>
          <span className="bell-face">{round.stoppedBy ? '🚏 Stopping…' : 'BUSSTOP!'}</span>
        </button>
        {!allValid && !timeUp && (
          <p className="hint">
            {filled}/{round.categories.length} done – fill them all to press BUSSTOP!
          </p>
        )}
      </div>
    </div>
  );
}
