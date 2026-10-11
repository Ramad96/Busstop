import { useRef, useState, type FormEvent } from 'react';
import {
  DEFAULT_CATEGORIES,
  MAX_CATEGORIES,
  MAX_CATEGORY_LENGTH,
  type Settings,
} from '@letter-race/core';
import { formatSeconds } from '../util';

const TIMER_OPTIONS = [60, 90, 120, 180];

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Partial<Settings>) => Promise<unknown> | void;
}) {
  // Custom categories stay in the list even while switched off.
  const [custom, setCustom] = useState(() =>
    settings.categories.filter((c) => !DEFAULT_CATEGORIES.includes(c)),
  );
  const [draft, setDraft] = useState('');
  // While category changes are in flight, show (and build on) what we asked for, so quick
  // taps on a slow connection don't undo each other.
  const [requested, setRequested] = useState<string[] | null>(null);
  const inFlight = useRef(0);
  const enabled = new Set(requested ?? settings.categories);
  const allCategories = [
    ...DEFAULT_CATEGORIES,
    ...custom,
    ...settings.categories.filter((c) => !DEFAULT_CATEGORIES.includes(c) && !custom.includes(c)),
  ];

  async function setEnabled(next: Set<string>, list = allCategories) {
    const categories = list.filter((c) => next.has(c));
    setRequested(categories);
    inFlight.current++;
    await onChange({ categories });
    inFlight.current--;
    if (inFlight.current === 0) setRequested(null);
  }

  function toggleCategory(category: string) {
    const next = new Set(enabled);
    if (next.has(category)) next.delete(category);
    else next.add(category);
    void setEnabled(next);
  }

  function addCustom(e: FormEvent) {
    e.preventDefault();
    const name = draft.trim().replace(/\s+/g, ' ');
    if (!name) return;
    setDraft('');
    const existing = allCategories.find((c) => sameText(c, name));
    if (existing) {
      void setEnabled(new Set([...enabled, existing]));
      return;
    }
    const list = [...allCategories, name];
    setCustom((c) => [...c, name]);
    void setEnabled(new Set([...enabled, name]), list);
  }

  function removeCustom(category: string) {
    setCustom((c) => c.filter((x) => x !== category));
    const next = new Set(enabled);
    next.delete(category);
    void setEnabled(next);
  }

  return (
    <section className="settings">
      <h3>Settings</h3>
      <div className="field">
        <span>Timer</span>
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
        <span>
          Categories <small className="muted">({enabled.size} on)</small>
        </span>
        <div className="chips">
          {allCategories.map((c) => (
            <span key={c} className="chip-wrap">
              <button
                type="button"
                className={`chip ${enabled.has(c) ? 'on' : ''}`}
                aria-pressed={enabled.has(c)}
                onClick={() => toggleCategory(c)}
              >
                {c}
              </button>
              {!DEFAULT_CATEGORIES.includes(c) && (
                <button
                  type="button"
                  className="chip-remove"
                  aria-label={`Remove ${c}`}
                  onClick={() => removeCustom(c)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        <form className="add-category" onSubmit={addCustom}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add your own, e.g. Animal"
            maxLength={MAX_CATEGORY_LENGTH}
            aria-label="New category"
            enterKeyHint="done"
          />
          <button
            className="btn btn-small"
            disabled={!draft.trim() || enabled.size >= MAX_CATEGORIES}
          >
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
