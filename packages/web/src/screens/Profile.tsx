import { useState, type FormEvent } from 'react';
import { CHARACTER_IDS, MAX_NAME_LENGTH, type CharacterId } from '@letter-race/core';
import { CharacterPicker } from '../components/CharacterPicker';
import { ErrorText } from '../components/ErrorText';
import { game } from '../net/socket';
import { storage } from '../net/storage';

const PROFILE_KEY = 'letterRace.profile';

function loadProfile(): { name: string; character: CharacterId } {
  try {
    const saved = JSON.parse(storage.get(PROFILE_KEY) ?? '{}');
    return {
      name: typeof saved.name === 'string' ? saved.name : '',
      character: CHARACTER_IDS.includes(saved.character) ? saved.character : CHARACTER_IDS[0],
    };
  } catch {
    return { name: '', character: CHARACTER_IDS[0] };
  }
}

/** Pick a name and character, then host or join. */
export function Profile({ code, onBack }: { code: string | null; onBack: () => void }) {
  const [profile] = useState(loadProfile);
  const [name, setName] = useState(profile.name);
  const [character, setCharacter] = useState<CharacterId>(profile.character);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    storage.set(PROFILE_KEY, JSON.stringify({ name: name.trim(), character }));
    const result = code
      ? await game.joinRoom(code, name, character)
      : await game.createRoom(name, character);
    setBusy(false);
    if (!result.ok) setError(result.error.message);
  }

  return (
    <form className="screen" onSubmit={submit}>
      <button type="button" className="btn-link back" onClick={onBack}>
        ← Back
      </button>
      <h2>{code ? `Joining ${code}` : 'Host a game'}</h2>
      <label className="field">
        <span>Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. Sam"
          autoFocus={!name}
          autoComplete="nickname"
          enterKeyHint="go"
        />
      </label>
      <div className="field">
        <span>Pick a character</span>
        <CharacterPicker value={character} onChange={setCharacter} />
      </div>
      <ErrorText message={error} />
      <button className="btn btn-primary btn-big" disabled={!name.trim() || busy}>
        {busy ? 'One sec…' : code ? 'Join game' : 'Create game'}
      </button>
    </form>
  );
}
