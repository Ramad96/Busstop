/**
 * Fails if packages/core uses anything outside plain ECMAScript: browser or Node APIs,
 * clocks or randomness. Keeps core portable (e.g. to Swift for iOS).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../packages/core/src/', import.meta.url).pathname;
const forbidden = [
  [/from\s+['"](?!\.{1,2}\/)[^'"]+['"]/, 'imports a package (core may only import its own files)'],
  [/\brequire\s*\(/, 'uses require()'],
  [/\bimport\s*\(/, 'uses dynamic import()'],
  [/\bDate\.now\s*\(/, 'reads the clock (pass time in)'],
  [/\bnew Date\s*\(/, 'creates a Date (pass time in)'],
  [/\bMath\.random\s*\(/, 'uses Math.random (pass randomness in)'],
  [
    /\b(window|document|navigator|localStorage|sessionStorage|location|fetch|XMLHttpRequest|WebSocket)\b\s*[.([]/,
    'uses a browser API',
  ],
  [/\b(process|Buffer|__dirname|__filename|global)\b\s*[.([]/, 'uses a Node API'],
  [
    /\b(setTimeout|setInterval|queueMicrotask|requestAnimationFrame)\s*\(/,
    'schedules work (core must be synchronous)',
  ],
  [/\bconsole\./, 'logs to the console'],
];

const problems = [];
for (const file of readdirSync(root)) {
  if (!file.endsWith('.ts') || file.endsWith('.test.ts') || file === 'testUtils.ts') continue;
  const lines = readFileSync(join(root, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    if (/^\s*(\*|\/\*)/.test(code)) return; // doc comments
    for (const [pattern, why] of forbidden) {
      if (pattern.test(code)) problems.push(`core/src/${file}:${i + 1} ${why}\n    ${line.trim()}`);
    }
  });
}

if (problems.length) {
  console.error(`packages/core is not pure:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('packages/core is pure: no browser, Node, clock or randomness APIs.');
