import { useState } from 'react';
import { normaliseRoomCode } from '@letter-race/core';
import { setMuted, useMuted } from './fx/sound';
import { useGame } from './net/socket';
import { Final } from './screens/Final';
import { Home } from './screens/Home';
import { JoinCode } from './screens/JoinCode';
import { Lobby } from './screens/Lobby';
import { Profile } from './screens/Profile';
import { Results } from './screens/Results';
import { Round } from './screens/Round';

type View =
  { name: 'home' } | { name: 'code'; code?: string } | { name: 'profile'; code: string | null };

/** A shared link looks like ?code=ABCD. Read it once, then tidy the URL. */
function initialView(): View {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  if (!code) return { name: 'home' };
  history.replaceState(null, '', location.pathname);
  return { name: 'code', code: normaliseRoomCode(code) };
}

export function App() {
  const { status, game: state, you, rejoining } = useGame();
  const [view, setView] = useState<View>(initialView);
  const muted = useMuted();

  let content;
  if (state) {
    switch (state.phase) {
      case 'lobby':
        content = <Lobby state={state} you={you} />;
        break;
      case 'reveal':
      case 'playing':
      case 'scoring':
        content = <Round state={state} you={you} />;
        break;
      case 'results':
        content = <Results state={state} you={you} />;
        break;
      case 'final':
        content = <Final state={state} you={you} />;
    }
  } else if (rejoining) {
    content = (
      <div className="screen center">
        <p className="muted">Getting you back in…</p>
      </div>
    );
  } else if (view.name === 'code') {
    content = (
      <JoinCode
        initialCode={view.code}
        onBack={() => setView({ name: 'home' })}
        onFound={(code) => setView({ name: 'profile', code })}
      />
    );
  } else if (view.name === 'profile') {
    content = <Profile code={view.code} onBack={() => setView({ name: 'home' })} />;
  } else {
    content = (
      <Home
        onHost={() => setView({ name: 'profile', code: null })}
        onJoin={() => setView({ name: 'code' })}
      />
    );
  }

  return (
    <div className="app">
      {status !== 'connected' && (
        <div className="connection-banner" role="status">
          {status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
        </div>
      )}
      {content}
      <button
        className="mute-toggle"
        onClick={() => setMuted(!muted)}
        aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}
