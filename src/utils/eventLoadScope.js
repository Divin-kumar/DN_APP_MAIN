// Each read belongs to the active account or guest scope. Re-selecting an
// in-flight scope must happen before joining its pending request.
export const createEventLoader = ({ get, set, readEvents, onError = console.error }) => {
  const pendingLoads = new Map();
  return async (uid, isGuest) => {
    const loadKey = `${isGuest ? 'guest' : 'user'}:${uid || 'anonymous'}`;
    const state = get();
    if (state.loadedFor === loadKey && state.activeLoadKey === loadKey) return state.events;
    set({
      loading: true,
      error: null,
      activeLoadKey: loadKey,
      ...(state.activeLoadKey !== loadKey ? { events: [], loadedFor: null } : {}),
    });
    if (pendingLoads.has(loadKey)) return pendingLoads.get(loadKey);

    const request = Promise.resolve().then(async () => {
      try {
        const events = await readEvents(uid, isGuest);
        if (get().activeLoadKey === loadKey) set({ events, loading: false, error: null, loadedFor: loadKey });
        return events;
      } catch (error) {
        onError('Failed to load events:', error);
        if (get().activeLoadKey === loadKey) set({ loading: false, error: 'Unable to load events.' });
        return [];
      } finally {
        pendingLoads.delete(loadKey);
      }
    });
    pendingLoads.set(loadKey, request);
    return request;
  };
};
