// Keep account/guest financial projections isolated across asynchronous loads.
// A scope is usable only when both its loaded and currently active keys match.
export const isFinancialScopeLoaded = (state, key) => Boolean(
  state && state.loadedFor === key && state.activeLoadKey === key
);


// The finance screen must never combine ledgers from two loading generations
// or display data from a different isolated Guest scenario. Both collections
// must match the active session before summary totals or cards can render.
export const isFinancialViewReady = (income, expense, key, sample = null) =>
  [income, expense].every((state, index) => (
    isFinancialScopeLoaded(state, key)
    && (state.loadedSample ?? null) === sample
    && (state.activeSample ?? null) === sample
    && Array.isArray(index === 0 ? state.incomes : state.expenses)
  ));

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
