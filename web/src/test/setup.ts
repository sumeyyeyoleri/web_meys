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

// jsdom's AbortSignal is not the one Node's fetch Request accepts; React Router builds
// Request objects on navigation. Tests don't abort navigations, so drop the signal.
const NodeRequest = globalThis.Request;
globalThis.Request = class extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    const { signal: _signal, ...rest } = init ?? {};
    super(input, rest);
  }
} as typeof Request;

// jsdom has no modal dialogs or object URLs.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}
if (!URL.createObjectURL) {
  let n = 0;
  URL.createObjectURL = () => `blob:test/${++n}`;
  URL.revokeObjectURL = () => undefined;
}
// jsdom's scrollTo only logs "not implemented".
window.scrollTo = () => undefined;
Element.prototype.scrollIntoView ??= () => undefined;

await import('../lib/i18n');

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
