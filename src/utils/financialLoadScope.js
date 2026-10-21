// Keep account/guest financial projections isolated across asynchronous loads.
// A scope is usable only when both its loaded and currently active keys match.
export const isFinancialScopeLoaded = (state, key) => Boolean(
  state && state.loadedFor === key && state.activeLoadKey === key
);

// Switching scopes invalidates cached records immediately. Merely hiding the
// stale records on Financials is not enough: other screens read these stores.
export const beginFinancialLoad = (state, key, collectionField) => ({
  loading: true,
  error: null,
  activeLoadKey: key,
  ...(state.activeLoadKey !== key
    ? { [collectionField]: [], loadedFor: null }
    : {}),
});
