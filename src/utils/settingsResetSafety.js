import { listStateScope } from './listStateMemory.js';

// Owner/account identity and isolated Guest demo must be stable throughout an
// async Settings reset, including while account Code Lists are being written.
export const settingsResetContext = ({ user, isGuest }, scenario = null) => ({
  uid: user?.uid || null,
  isGuest: Boolean(isGuest),
  scope: listStateScope({ user, isGuest }),
  scenario: scenario ?? null,
  loadKey: `${isGuest ? 'guest' : 'user'}:${user?.uid || 'anonymous'}`,
});

export const assertSettingsResetContext = (expected, current, scenario = null) => {
  const actual = settingsResetContext(current, scenario);
  if (!expected || expected.scope === 'signed-out'
    || actual.uid !== expected.uid || actual.isGuest !== expected.isGuest
    || actual.scope !== expected.scope || actual.scenario !== expected.scenario) {
    throw new Error('Your session changed during settings reset. Reopen Settings in the intended workspace and try again.');
  }
};

// A fulfilled loader Promise is not evidence of successful, scoped data:
// loaders deliberately resolve [] on an error or an out-of-date account load.
// Never retire Code List choices without verified current records from all
// three stores.
export const assertSettingsResetRecords = (expected, ...states) => {
  const collectionKeys = ['events', 'expenses', 'incomes'];
  const complete = states.length === collectionKeys.length && states.every((state, index) =>
    state && !state.loading && !state.error && state.loadedFor === expected.loadKey
    && state.activeLoadKey === expected.loadKey
    && (state.loadedSample ?? null) === expected.scenario
    && (state.activeSample ?? null) === expected.scenario
    && Array.isArray(state[collectionKeys[index]]));
  if (!complete) {
    throw new Error('DN could not verify all records in this workspace. No settings were reset. Please retry after data finishes loading.');
  }
};
