import { useState, type FormEvent } from 'react';
import { normaliseRoomCode, ROOM_CODE_LENGTH } from '@letter-race/core';
import { ErrorText } from '../components/ErrorText';
import { game } from '../net/socket';

export function JoinCode({
  initialCode = '',
  onBack,
  onFound,
}: {
  initialCode?: string;
  onBack: () => void;
  onFound: (code: string) => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clean = normaliseRoomCode(code).slice(0, ROOM_CODE_LENGTH);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await game.checkRoom(clean);
    setBusy(false);
    if (result.ok) onFound(clean);
    else setError(result.error.message);
  }

  return (
    <form className="screen" onSubmit={submit}>
      <button type="button" className="btn-link back" onClick={onBack}>
        ← Back
      </button>
      <h2>Enter game code</h2>
      <input
        className="code-input"
        value={clean}
        onChange={(e) => setCode(e.target.value)}
        placeholder="ABCD"
        autoFocus
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        maxLength={ROOM_CODE_LENGTH}
        aria-label="Game code"
      />
      <ErrorText message={error} />
      <button
        className="btn btn-primary btn-big"
        disabled={clean.length !== ROOM_CODE_LENGTH || busy}
      >
        {busy ? 'Checking…' : 'Next'}
      </button>
    </form>
  );
}
