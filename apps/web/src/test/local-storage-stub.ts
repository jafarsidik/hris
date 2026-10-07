/**
 * An in-memory `localStorage` for test environments where jsdom ships none.
 *
 * The components guard every storage read with `try/catch` and degrade to session-only
 * behaviour, so a missing `localStorage` never breaks them. Tests, however, assert on the
 * persisted strings, which is why they need a real object to write into here.
 */
export function installLocalStorageStub(): void {
  const store = new Map<string, string>();

  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, value),
  };

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: storage,
  });
}
