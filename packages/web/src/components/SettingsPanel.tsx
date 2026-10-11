import { DEFAULT_CATEGORIES, type Settings } from '@letter-race/core';
import { formatSeconds } from '../util';

const TIMER_OPTIONS = [60, 90, 120, 180];

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Partial<Settings>) => void;
}) {
  const enabled = new Set(settings.categories);
  const allCategories = [
    ...DEFAULT_CATEGORIES,
    ...settings.categories.filter((c) => !DEFAULT_CATEGORIES.includes(c)),
  ];

  function toggleCategory(category: string) {
    const next = new Set(enabled);
    if (next.has(category)) next.delete(category);
    else next.add(category);
    onChange({ categories: allCategories.filter((c) => next.has(c)) });
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
        <span>Categories</span>
        <div className="chips">
          {allCategories.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip ${enabled.has(c) ? 'on' : ''}`}
              aria-pressed={enabled.has(c)}
              onClick={() => toggleCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
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
