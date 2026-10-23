import type { GameState } from '@busstop/core';
import { Avatar } from './Avatar';

export function PlayerList({ game, you }: { game: GameState; you: string | null }) {
  return (
    <ul className="player-list">
      {game.players.map((p) => (
        <li key={p.id} className={p.connected ? '' : 'offline'}>
          <Avatar character={p.character} />
          <span className="player-name">
            {p.name}
            {p.id === you && <span className="tag">you</span>}
          </span>
          {p.id === game.hostId && (
            <span className="tag driver" title="Host – runs the game">
              🚌 driver
            </span>
          )}
          {!p.connected && <span className="tag muted">away</span>}
          {p.spectating && <span className="tag muted">watching</span>}
        </li>
      ))}
    </ul>
  );
}
