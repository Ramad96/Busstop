import { useRef, useState, type FormEvent } from 'react';
import {
  CATEGORY_BANK,
  MAX_CATEGORIES,
  MAX_CATEGORY_LENGTH,
  randomCategories,
  type Settings,
} from '@letter-race/core';
import { formatSeconds } from '../util';

const TIMER_OPTIONS = [60, 90, 120, 180];
const ROUND_OPTIONS = [3, 5, 8, 10];

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Partial<Settings>) => Promise<unknown> | void;
}) {
  const [draft, setDraft] = useState('');
  // While category changes are in flight, show (and build on) what we asked for, so quick
  // taps on a slow connection don't undo each other.
  const [requested, setRequested] = useState<string[] | null>(null);
  const inFlight = useRef(0);
  const selected = requested ?? settings.categories;
  const available = CATEGORY_BANK.filter((c) => !selected.some((s) => sameText(s, c)));
  const full = selected.length >= MAX_CATEGORIES;

  async function setCategories(categories: string[]) {
    setRequested(categories);
    inFlight.current++;
    await onChange({ categories });
    inFlight.current--;
    if (inFlight.current === 0) setRequested(null);
  }

  function add(category: string) {
    if (full || selected.some((s) => sameText(s, category))) return;
    void setCategories([...selected, category]);
  }

  function remove(category: string) {
    void setCategories(selected.filter((c) => c !== category));
  }

  function addCustom(e: FormEvent) {
    e.preventDefault();
    const name = draft.trim().replace(/\s+/g, ' ');
    if (!name) return;
    setDraft('');
    add(CATEGORY_BANK.find((c) => sameText(c, name)) ?? name);
  }

  return (
    <section className="settings panel">
      <h3 className="panel-title">Timetable</h3>

      <div className="field">
        <span className="field-label">Rounds</span>
        <div className="chips">
          {ROUND_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`chip ${settings.totalRounds === n ? 'on' : ''}`}
              aria-pressed={settings.totalRounds === n}
              onClick={() => onChange({ totalRounds: n })}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Time per round</span>
        <div className="chips">
          {TIMER_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${settings.roundSeconds === s ? 'on' : ''}`}
              aria-pressed={settings.roundSeconds === s}
              onClick={() => onChange({ roundSeconds: s })}
            >
              {formatSeconds(s)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">
          Categories{' '}
          <small className="muted">
            {selected.length}/{MAX_CATEGORIES}
          </small>
        </span>
        <div className="chips">
          {selected.map((c) => (
            <button
              key={c}
              type="button"
              className="chip on removable"
              onClick={() => remove(c)}
              disabled={selected.length === 1}
              aria-label={`Remove ${c}`}
            >
              {c} <span aria-hidden>×</span>
            </button>
          ))}
        </div>
        <div className="category-tools">
          <span className="field-sublabel">Add more</span>
          <button
            type="button"
            className="btn btn-small btn-ghost"
            onClick={() => void setCategories(randomCategories(Math.random))}
          >
            🎲 Random 6
          </button>
        </div>
        <div className="chips">
          {available.map((c) => (
            <button
              key={c}
              type="button"
              className="chip addable"
              onClick={() => add(c)}
              disabled={full}
              aria-label={`Add ${c}`}
            >
              <span aria-hidden>+</span> {c}
            </button>
          ))}
        </div>
        <form className="add-category" onSubmit={addCustom}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Your own, e.g. Superhero"
            maxLength={MAX_CATEGORY_LENGTH}
            aria-label="New category"
            enterKeyHint="done"
          />
          <button className="btn btn-small" disabled={!draft.trim() || full}>
            Add
          </button>
        </form>
      </div>

      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.includeHardLetters}
          onChange={(e) => onChange({ includeHardLetters: e.target.checked })}
        />
        <span>Include hard letters (Q, U, V, X, Y, Z)</span>
      </label>
    </section>
  );
}
