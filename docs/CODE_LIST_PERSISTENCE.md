# Code List persistence and migration

## Root cause

The Code Lists screen calls `useAppStore.setAdminValues()`. Before this change, that action only wrote `lifehub_admin_values` and its schema version to `localStorage`. Authentication initialization did not fetch code-list settings, and no Firestore settings path existed. Therefore updates were browser-specific and disappeared when using another browser/device or clearing site data.

## Implemented behavior

- Authenticated account settings use `users/{uid}/settings/codelists`.
- Document shape:

  ```json
  {
    "adminValues": {
      "eventTypes": [],
      "incomeTypes": [],
      "expenseCategories": [],
      "activityPriorities": [],
      "reminderPresets": []
    },
    "schemaVersion": 1,
    "updatedAt": "ISO-8601 timestamp"
  }
  ```

- Authentication waits for code-list settings hydration before protected routes become ready. A Firestore transaction initializes missing account settings from eligible legacy browser values or defaults, while existing Firestore lists remain authoritative, including intentionally empty lists.
- Authenticated edits/reset/backup restore write the account document. Writes are serialized, optimistic UI is rolled back to the last persisted snapshot on failure, and the Code Lists page shows load/save errors instead of silently claiming success.
- Guest mode uses `lifehub_guest_admin_values` and `lifehub_guest_admin_values_schema_version` in localStorage. On first guest use, existing `lifehub_admin_values` data is copied to the guest-specific keys and retained as a compatibility copy.
- Backup format v2 now includes `collections.codeLists` and `collections.codeListSchemaVersion`; restore routes lists to the currently active account or guest store.

## Existing localStorage migration

On the first authenticated settings load, if the Firestore document does not contain a valid `adminValues` object, the migration reads the active guest-specific key when guest mode is active; otherwise it reads `lifehub_admin_values` and its schema version. Auth initialization loads these settings before the guest-record migration clears the guest-mode marker. It normalizes/migrates the lists, writes them to the signed-in account document in a transaction, and then uses Firestore as the source of truth on later loads. If there is no usable local list, defaults are written for a new account. A valid remote document always wins; local values never overwrite it.

**Shared-browser limitation:** legacy localStorage has no historical account/owner marker. The first account signed into a browser with an uninitialized Code Lists document may inherit that browser's legacy lists. If browsers are shared between accounts, review/confirm ownership of legacy values before initial sign-in migration. After the account document exists, the remote document is authoritative and prevents later cross-account local values from overriding it.

## Required Firebase configuration

Firestore Security Rules must allow an authenticated user to read/write only their own `users/{uid}/settings/codelists` document. No rules source or Firebase Emulator configuration was present in the reviewed workspace, so this implementation cannot verify or change deployed rules. If deployed rules deny the path, hydration will show a retryable error and the client will not silently replace account lists with defaults.

## Verification

Automated checks cover remote precedence, missing-account defaults, legacy migration, and guest-local behavior. Run `npm test` and `npm run build` from the application root.

Manual acceptance checks with Firebase configured:

1. Sign in; create a Moment Type and Expense Category; verify the document at `users/{uid}/settings/codelists` contains them.
2. Refresh and confirm the values remain.
3. Sign in to the same account in a second browser/device and confirm values load without import/export.
4. Sign out/in and confirm the same values return.
5. Clear browser site data and sign in again; confirm Firestore repopulates the lists.
6. Sign in as a new account and verify all defaults are initialized in that account's settings document.
7. Enter guest mode, edit lists, reload; confirm guest values persist locally and do not write to a user document.
8. Deny/offline the Firestore write; confirm the UI reports failure and a refresh restores the last persisted values.

The workspace build/test does not exercise live Firestore, deployed security rules, multi-browser behavior, or site-data clearing. Those acceptance checks require the configured Firebase project and must be performed before calling cross-device synchronization verified.
