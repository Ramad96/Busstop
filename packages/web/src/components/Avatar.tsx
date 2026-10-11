import { CHARACTERS, type CharacterId } from '@letter-race/core';

export function characterEmoji(id: CharacterId): string {
  return CHARACTERS.find((c) => c.id === id)?.emoji ?? '❓';
}

export function Avatar({
  character,
  size = 'md',
}: {
  character: CharacterId;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span className={`avatar avatar-${size}`} aria-hidden>
      {characterEmoji(character)}
    </span>
  );
}
