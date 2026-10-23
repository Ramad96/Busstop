/**
 * Message shapes between client and server. Types only – no network code lives in core.
 * Documented in docs/PROTOCOL.md; keep the two in sync.
 */
import type { GameErrorCode } from './state';
import type {
  Answers,
  ChallengeVerdict,
  CharacterId,
  GameState,
  PlayerId,
  Settings,
} from './types';

export type ErrorCode = GameErrorCode | 'room_not_found' | 'bad_request' | 'not_in_room';

export interface ErrorInfo {
  code: ErrorCode;
  message: string;
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: ErrorInfo };
export type AckFn<T = object> = (response: Ack<T>) => void;

export interface JoinedRoom {
  code: string;
  playerId: PlayerId;
}

export interface StateMessage {
  state: GameState;
  /** Server clock when this was sent (epoch ms). */
  serverNow: number;
  /** The receiving player's id. */
  you: PlayerId;
}

export interface ClientToServerEvents {
  'time:ping': (ack: (serverNow: number) => void) => void;
  'room:check': (data: { code: string }, ack: AckFn<{ phase: GameState['phase'] }>) => void;
  'room:create': (data: { name: string; character: CharacterId }, ack: AckFn<JoinedRoom>) => void;
  'room:join': (
    data: { code: string; name: string; character: CharacterId },
    ack: AckFn<JoinedRoom>,
  ) => void;
  'room:rejoin': (data: { code: string }, ack: AckFn<JoinedRoom>) => void;
  'room:leave': (ack?: AckFn) => void;
  'settings:update': (data: { settings: Partial<Settings> }, ack?: AckFn) => void;
  'game:start': (ack?: AckFn) => void;
  'game:end': (ack?: AckFn) => void;
  'answers:update': (data: { answers: Answers }, ack?: AckFn) => void;
  'answers:submit': (data: { answers: Answers }, ack?: AckFn) => void;
  'clock:stop': (data: { answers: Answers }, ack?: AckFn) => void;
  'game:new': (ack?: AckFn) => void;
  'answer:challenge': (data: { targetId: PlayerId; category: string }, ack?: AckFn) => void;
  'challenge:vote': (
    data: { targetId: PlayerId; category: string; verdict: ChallengeVerdict },
    ack?: AckFn,
  ) => void;
}

export interface ServerToClientEvents {
  state: (message: StateMessage) => void;
}
