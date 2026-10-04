import { MIGRATION_STATE, MIGRATION_STATES } from './migrationConstants.js';

const ALLOWED_TRANSITIONS = Object.freeze({
  [MIGRATION_STATE.NOT_STARTED]: [MIGRATION_STATE.CHECKING_SOURCE, MIGRATION_STATE.FAILED],
  [MIGRATION_STATE.CHECKING_SOURCE]: [MIGRATION_STATE.SNAPSHOT_CREATED, MIGRATION_STATE.FAILED],
  [MIGRATION_STATE.SNAPSHOT_CREATED]: [MIGRATION_STATE.IMPORT_PREVIEW, MIGRATION_STATE.FAILED],
  [MIGRATION_STATE.IMPORT_PREVIEW]: [MIGRATION_STATE.IMPORTING, MIGRATION_STATE.FAILED],
  [MIGRATION_STATE.IMPORTING]: [MIGRATION_STATE.VALIDATING, MIGRATION_STATE.FAILED],
  [MIGRATION_STATE.VALIDATING]: [MIGRATION_STATE.COMMIT_READY, MIGRATION_STATE.FAILED],
  [MIGRATION_STATE.COMMIT_READY]: [MIGRATION_STATE.COMPLETED, MIGRATION_STATE.FAILED],
  [MIGRATION_STATE.COMPLETED]: [MIGRATION_STATE.ROLLED_BACK],
  [MIGRATION_STATE.FAILED]: [MIGRATION_STATE.ROLLED_BACK],
  [MIGRATION_STATE.ROLLED_BACK]: [],
});

export const getAllowedMigrationTransitions = (state) => [...(ALLOWED_TRANSITIONS[state] || [])];

export const canTransitionMigration = (from, to) =>
  MIGRATION_STATES.includes(from) && getAllowedMigrationTransitions(from).includes(to);

export const assertMigrationTransition = (from, to) => {
  if (!canTransitionMigration(from, to)) {
    throw new Error(`Invalid migration state transition: ${String(from)} -> ${String(to)}`);
  }
  return true;
};

export const transitionMigrationRun = (run, nextState, details = {}, now = new Date().toISOString()) => {
  if (!run || !MIGRATION_STATES.includes(run.state)) {
    throw new Error('A valid migration run is required to transition state.');
  }

  assertMigrationTransition(run.state, nextState);
  return {
    ...run,
    state: nextState,
    updatedAt: now,
    stateHistory: [
      ...(Array.isArray(run.stateHistory) ? run.stateHistory : []),
      { from: run.state, to: nextState, at: now, ...details },
    ],
  };
};

export default {
  getAllowedMigrationTransitions,
  canTransitionMigration,
  assertMigrationTransition,
  transitionMigrationRun,
};
