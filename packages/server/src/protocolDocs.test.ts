import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const docs = read('../../../docs/PROTOCOL.md');
const sockets = read('./sockets.ts');
const protocol = read('../../core/src/protocol.ts');
const state = read('../../core/src/state.ts');

const handled = [...sockets.matchAll(/socket\.on\(\s*'([^']+)'/g)]
  .map((m) => m[1])
  .filter((e) => e !== 'disconnect');
const typed = [...protocol.matchAll(/^\s+'([a-z]+:[a-z]+)':/gm)].map((m) => m[1]);
const documented = [...docs.matchAll(/^\| `([a-z]+:[a-z]+)`/gm)].map((m) => m[1]);

describe('docs/PROTOCOL.md', () => {
  it('documents exactly the events the server handles', () => {
    expect(handled.length).toBeGreaterThan(5);
    expect([...documented].sort()).toEqual([...handled].sort());
  });

  it('matches the typed protocol in core', () => {
    expect([...typed].sort()).toEqual([...handled].sort());
  });

  it('documents every error code', () => {
    const gameCodes = [...state.matchAll(/^\s+\| '([a-z_]+)'/gm)].map((m) => m[1]);
    const extra = (protocol.match(/ErrorCode = GameErrorCode((?:\s*\|\s*'[a-z_]+')+)/)?.[1] ?? '')
      .match(/'([a-z_]+)'/g)!
      .map((s) => s.slice(1, -1));
    for (const code of [...gameCodes, ...extra]) {
      expect(docs, `missing error code ${code}`).toContain(`| \`${code}\``);
    }
  });
});
