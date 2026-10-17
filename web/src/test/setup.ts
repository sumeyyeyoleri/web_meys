import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Node ≥ 25 exposes its own (file-backed) localStorage global, which hides jsdom's and is
// undefined without --localstorage-file. Provide an in-memory Storage for tests.
if (!window.localStorage) {
  const store = new Map<string, string>();
  const storage: Storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
}

await import('../lib/i18n');

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
