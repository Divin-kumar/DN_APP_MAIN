import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import useAppStore from '../store/useAppStore';
import { listStateKey, listStateMemory, listStateScope, readLegacyTransactionFilters } from '../utils/listStateMemory';

export default function usePersistentListState(listKey, defaults, rules = {}) {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const scope = listStateScope({ user, isGuest });
  const key = listStateKey(scope, listKey);
  const activeKey = useRef(key);
  activeKey.current = key;
  const legacy = listKey === 'transactions' && scope !== 'signed-out' ? () => readLegacyTransactionFilters(scope) : undefined;
  const subscribe = useCallback((notify) => listStateMemory.subscribe(key, notify), [key]);
  const getSnapshot = useCallback(() => listStateMemory.read(key, defaults, rules, legacy), [key, defaults, rules]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    const receive = (event) => {
      if (event.key === key) listStateMemory.receiveStorage(key, event.newValue);
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, [key]);

  const canWrite = () => activeKey.current === key && scope !== 'signed-out'
    && listStateScope(useAppStore.getState()) === scope;
  const change = (patch) => {
    // A callback from a previous account/Moment must not overwrite its saved choices.
    if (canWrite()) listStateMemory.update(key, defaults, rules, patch);
  };
  const reset = () => {
    if (canWrite()) listStateMemory.reset(key, defaults, rules);
  };
  // Optional fourth entry lets draft editors cancel delayed input on a scope
  // switch without changing the existing value/change/reset tuple contract.
  return [value, change, reset, key];
}
