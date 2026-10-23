import { CHARACTERS, type CharacterId } from '@busstop/core';

export function CharacterPicker({
  value,
  onChange,
}: {
  value: CharacterId;
  onChange: (id: CharacterId) => void;
}) {
  return (
    <div className="character-grid" role="radiogroup" aria-label="Character">
      {CHARACTERS.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={value === c.id}
          aria-label={c.label}
          className={`character ${value === c.id ? 'selected' : ''}`}
          onClick={() => onChange(c.id)}
        >
          {c.emoji}
        </button>
      ))}
    </div>
  );
}
