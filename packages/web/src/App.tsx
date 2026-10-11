import { useState } from 'react';
import { normaliseRoomCode } from '@letter-race/core';
import { useGame } from './net/socket';
import { Home } from './screens/Home';
import { JoinCode } from './screens/JoinCode';
import { Lobby } from './screens/Lobby';
import { Profile } from './screens/Profile';

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

  let content;
  if (state) {
    switch (state.phase) {
      case 'lobby':
        content = <Lobby state={state} you={you} />;
        break;
      default:
        content = (
          <div className="screen center">
            <p>Round in progress… (coming in Phase 4)</p>
          </div>
        );
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
    </div>
  );
}
