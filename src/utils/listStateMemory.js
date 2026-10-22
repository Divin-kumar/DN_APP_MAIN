// Browser-only UI choices. Business records and Firebase are never read or written.
export const listStateScope = ({ user, isGuest } = {}) => user?.uid
  ? `account:${user.uid}` : isGuest ? 'guest' : 'signed-out';

export const listStateKey = (scope, listKey) => `dn_list_state_${encodeURIComponent(scope)}_${encodeURIComponent(listKey)}`;

export const normalizeListState = (value, defaults, rules = {}) => Object.fromEntries(
  Object.entries(defaults).map(([name, fallback]) => {
    const candidate = value?.[name];
    const rule = rules[name];
    const valid = typeof candidate === typeof fallback
      && (!Array.isArray(rule) || rule.includes(candidate))
      && (typeof rule !== 'function' || rule(candidate));
    return [name, valid ? candidate : fallback];
  }),
);

// The in-memory copy preserves choices when storage is unavailable/full.
// getSnapshot returns a stable object, as required by useSyncExternalStore.
export const createListStateMemory = (getStorage = () => globalThis.localStorage) => {
  const snapshots = new Map();
  const listeners = new Map();
  const configurations = new Map();
  const parse = (raw) => { try { return JSON.parse(raw || '{}'); } catch { return {}; } };
  const emit = (key) => listeners.get(key)?.forEach((notify) => notify());
  const persist = (key, value) => {
    try { getStorage()?.setItem(key, JSON.stringify(value)); } catch { /* UI memory remains available. */ }
  };
  const read = (key, defaults, rules = {}, legacy) => {
    configurations.set(key, { defaults, rules });
    if (!snapshots.has(key)) {
      let raw = null;
      try { raw = getStorage()?.getItem(key); } catch { /* Use memory/defaults. */ }
      let value = parse(raw);
      if (raw == null && legacy) {
        try { value = legacy() || {}; } catch { /* Optional migration only. */ }
      }
      const next = normalizeListState(value, defaults, rules);
      snapshots.set(key, next);
      if (raw == null && legacy) persist(key, next);
    }
    return snapshots.get(key);
  };
  return {
    read,
    update(key, defaults, rules, patch) {
      const current = read(key, defaults, rules);
      const next = normalizeListState({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) }, defaults, rules);
      snapshots.set(key, next);
      persist(key, next);
      emit(key);
      return next;
    },
    reset(key, defaults, rules) {
      const next = normalizeListState(defaults, defaults, rules);
      snapshots.set(key, next);
      persist(key, next);
      emit(key);
      return next;
    },
    subscribe(key, notify) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(notify);
      return () => { listeners.get(key)?.delete(notify); };
    },
    receiveStorage(key, raw) {
      const config = configurations.get(key);
      if (!config) return;
      snapshots.set(key, normalizeListState(parse(raw), config.defaults, config.rules));
      emit(key);
    },
  };
};

export const listStateMemory = createListStateMemory();

export const readLegacyTransactionFilters = (scope) => {
  const oldScope = scope.startsWith('account:') ? scope.slice('account:'.length) : scope;
  if (oldScope !== 'guest' && !scope.startsWith('account:')) return null;
  try { return JSON.parse(globalThis.sessionStorage?.getItem(`dn_transactions_filters_${oldScope}`) || 'null'); }
  catch { return null; }
};
