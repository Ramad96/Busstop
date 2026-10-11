import { DEFAULT_SETTINGS } from '@letter-race/core';

export function App() {
  return (
    <main>
      <h1>Letter Race</h1>
      <p>{DEFAULT_SETTINGS.categories.join(', ')}</p>
    </main>
  );
}
