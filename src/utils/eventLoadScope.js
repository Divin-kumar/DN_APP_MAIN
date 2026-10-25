// Each read belongs to the active account or guest scope. Re-selecting an
// in-flight scope must happen before joining its pending request.
export const createEventLoader = ({ get, set, readEvents, getSample = () => null, onError = console.error }) => {
  const pendingLoads = new Map();
  return async (uid, isGuest) => {
    const loadKey = `${isGuest ? 'guest' : 'user'}:${uid || 'anonymous'}`;
    const sample = getSample(uid);
    const requestKey = JSON.stringify([loadKey, sample]);
    const state = get();
    if (state.loadedFor === loadKey && state.activeLoadKey === loadKey
      && (state.loadedSample ?? null) === sample && (state.activeSample ?? null) === sample) return state.events;
    const changedScope = state.activeLoadKey !== loadKey || (state.activeSample ?? null) !== sample;
    set({
      loading: true,
      error: null,
      activeLoadKey: loadKey,
      activeSample: sample,
      ...(changedScope ? { events: [], loadedFor: null, loadedSample: null, scopeRevision: (state.scopeRevision || 0) + 1 } : {}),
    });
    if (pendingLoads.has(requestKey)) return pendingLoads.get(requestKey);

    const request = Promise.resolve().then(async () => {
      try {
        const events = await readEvents(uid, isGuest);
        if (get().activeLoadKey === loadKey && (get().activeSample ?? null) === sample) set({ events, loading: false, error: null, loadedFor: loadKey, loadedSample: sample });
        return events;
      } catch (error) {
        onError('Failed to load events:', error);
        if (get().activeLoadKey === loadKey && (get().activeSample ?? null) === sample) set({ loading: false, error: 'Unable to load events.' });
        return [];
      } finally {
        pendingLoads.delete(requestKey);
      }
    });
    pendingLoads.set(requestKey, request);
    return request;
  };
};
