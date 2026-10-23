import { useState } from 'react';
import type { GameState, Settings } from '@letter-race/core';
import { ErrorText } from '../components/ErrorText';
import { PlayerList } from '../components/PlayerList';
import { SettingsPanel } from '../components/SettingsPanel';
import { game } from '../net/socket';
import { formatSeconds, shareLink } from '../util';

export function Lobby({ state, you }: { state: GameState; you: string | null }) {
  const isHost = state.hostId === you;
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  async function share() {
    const url = shareLink(state.code);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Letter Race', text: `Join my game: ${state.code}`, url });
        return;
      } catch {
        // Cancelled or unsupported – fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(url);
    }
  }

  async function updateSettings(settings: Partial<Settings>) {
    setError(null);
    const result = await game.updateSettings(settings);
    if (!result.ok) setError(result.error.message);
  }

  async function start() {
    setStarting(true);
    setError(null);
    const result = await game.startGame();
    setStarting(false);
    if (!result.ok) setError(result.error.message);
  }

  return (
    <div className="screen lobby">
      <div className="lobby-header">
        <button className="btn-link back" onClick={() => game.leaveRoom()}>
          ← Leave
        </button>
      </div>
      <div className="code-card">
        <span className="label">Game code</span>
        <span className="big-code">{state.code}</span>
        <button className="btn btn-small" onClick={share}>
          {copied ? 'Link copied!' : 'Share link'}
        </button>
      </div>

      <section>
        <h3>
          Players <span className="count">{state.players.length}</span>
        </h3>
        <PlayerList game={state} you={you} />
      </section>

      {isHost ? (
        <SettingsPanel settings={state.settings} onChange={updateSettings} />
      ) : (
        <section className="settings-summary">
          <h3>Settings</h3>
          <p>
            {state.settings.totalRounds} rounds · ⏱ {formatSeconds(state.settings.roundSeconds)} ·{' '}
            {state.settings.includeHardLetters ? 'All letters' : 'No hard letters'}
          </p>
          <div className="chips">
            {state.settings.categories.map((c) => (
              <span key={c} className="chip static">
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      <ErrorText message={error} />

      <div className="sticky-footer">
        {isHost ? (
          <button className="btn btn-primary btn-big" onClick={start} disabled={starting}>
            {state.players.length < 2 ? 'Start (solo)' : 'Start!'}
          </button>
        ) : (
          <p className="waiting">Waiting for the host to start…</p>
        )}
      </div>
    </div>
  );
}
