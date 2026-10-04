# Sprint 2 — Deliverable 6C: Offline Readiness Remediation Specification

**Status:** Implementation specification only. No code was generated and no browser/Safari tests were run by this document.  
**Scope:** Remediate the three Deliverable 6B blockers: database metadata/schema version consistency, silent conflicting duplicate-ID overwrites, and missing browser/PWA offline certification.  
**Fixed decisions:** Keep the existing UI → Store → Repository → Dexie architecture; do not redesign repositories or data models; do not implement Sync or Backup/Restore UI.

## Current evidence and blocker summary

| Blocker | Repository evidence | Required response |
|---|---|---|
| Metadata schema version mismatch | Dexie schema version is `2`; `DEFAULT_METADATA.schemaVersion` and `DATABASE_VERSION_INFO.current` are `1`. `ensureDatabaseMetadata()` recreates a missing schema-version row from `DEFAULT_METADATA` and overwrites every metadata row from defaults on each boot. | Establish one schema-version owner, repair existing metadata only after Dexie has opened/upgraded, and stop boot from rewriting independent migration state. |
| Duplicate primary-ID overwrite | Moment/Activity/Memory/Attachment `create()` methods call `put()`; Expense/Income `upsert()` deliberately overwrites the row found by ID; bulk writes use `bulkPut()`. The primary key prevents two physical rows but does not stop a conflicting second create from silently replacing data. Settings and Code List logical compound indexes are not unique. | Preserve repository APIs/model shapes, but add an atomic duplicate/conflict guard at repository write boundaries and use operation intent (create vs update/upsert) to determine outcomes. |
| Browser/PWA offline certification missing | Deliverable 6B used fake IndexedDB in Node and simulated database close/reopen; it did not test actual browser refresh, persistent profiles, multi-tab behavior, service-worker lifecycle, iPhone Safari, or Home Screen PWA. | Run a documented browser matrix using production artifacts, then physical iPhone Safari/PWA tests. Report simulated and physical evidence separately. |

## 1. Metadata Version Consistency Plan

### 1.1 Version ownership

There are three distinct version concepts. They must stay separate:

1. **Dexie schema version** — the sole structural version authority is `DATABASE_SCHEMA_VERSION` in `src/database/schema.js`. It is the version passed to `db.version(...).stores(...)` and describes IndexedDB stores/indexes.
2. **Opened database version** — after `db.open()` succeeds, Dexie `db.verno` is the runtime fact for the database structure actually opened/upgraded. It must equal the source schema version for a supported installation.
3. **Data migration version** — `MIGRATION_VERSION`/`migrationRuns.migrationVersion` is the version of a Firebase/localStorage-to-Dexie transformation. It is not the Dexie schema version. The schema registry (`src/migrations/registry.js`) and data migration registry must not reinterpret each other's version numbers.

`metadata.schemaVersion` is a mirror/checkpoint of the opened Dexie schema, not a second independent authority. The old `DATABASE_VERSION_INFO.current` should be removed from active decision-making or derived from `DATABASE_SCHEMA_VERSION`; it must not remain an independent value.

### 1.2 Synchronization and safe repair

**Startup sequence**

1. Open Dexie and allow Dexie to perform the registered forward schema upgrade.
2. Confirm the opened database version is supported and equals `DATABASE_SCHEMA_VERSION`.
3. In a small metadata-only Dexie transaction, read the schema-version row and update/create it to the verified opened version.
4. Validate migration control metadata separately; preserve `migrationRuns`/`migrationAudit` as authoritative run history.
5. Only after these checks pass, mark the local database ready and permit persistent store hydration.

**Repair policy**

- Missing schema-version row: create it using verified `db.verno` after open; do not reset domain tables.
- Valid older metadata version with a successfully upgraded DB: advance metadata to `db.verno`, append a repair/upgrade audit event, preserve all existing domain rows.
- Metadata version greater than `db.verno`, malformed/non-integer, or unsupported future schema: do not guess or downgrade. Block normal CRUD, preserve the database unchanged, report an integrity failure, and require a supported recovery/upgrade path.
- Dexie open/upgrade failure: do not write `schemaVersion=ready`, do not clear/recreate the database, and do not allow the app to claim persistent readiness.
- Never infer that a fresh `metadata.schemaVersion` record proves user-data migration completed.

### 1.3 Metadata semantics and validation rules

| Metadata item | Meaning | Startup rule |
|---|---|---|
| `schemaVersion` | Dexie structure version currently open | Must be an integer equal to `db.verno` and `DATABASE_SCHEMA_VERSION` after successful upgrade |
| `migrationStatus` | Summary/readiness projection for user-data migration, if retained | Must not be reset to `pending` on every boot; detailed run state remains in `migrationRuns` |
| `lastSuccessfulMigration` | Data-import completion reference, including migration version/run ID/time | Preserve existing value during normal database boot; update only in the atomic migration completion path |
| `rollbackStatus` | Data migration rollback/recovery summary | Preserve active/recovery state; schema boot must not overwrite it with `none` |
| `updatedAt` | Timestamp for that metadata record | Update only when that record changes; not a substitute for version validation |

Validation rules:

- Schema versions are positive integers; future/unsupported versions fail closed.
- `db.verno` must be finite and equal to the current code schema after open.
- Schema-version repair and database-ready transition must be atomic with respect to the metadata row.
- Migration completion/rollback metadata must be changed only by `MigrationCoordinator`/rollback path, not by `buildMetadataEntries()` defaults on every launch.
- Record a stable diagnostic code, stored version, runtime version, source schema version, and repair outcome without logging user records.

### 1.4 Files and regression points for this blocker

Expected later implementation touch points: `src/database/schema.js`, `src/database/metadata.js`, `src/database/boot.js`, and `src/database/versioning.js`; migration state remains owned by the existing migration framework. No database table redesign is required.

Revalidate both a populated v1 database upgraded to v2 and an already-v2 database with missing/corrupt metadata. Assert every domain table row/checksum is unchanged by metadata repair. Confirm a completed migration remains completed after multiple app boots.

## 2. Duplicate Protection Strategy

### 2.1 Shared write policy

The rule is **same identity + same content = idempotent duplicate; same identity + different content = conflict; explicit update = update; ambiguous similarity = never auto-merge**.

For every write, determine principal and canonical identity before any `put`/`bulkPut`:

1. Validate non-empty `userId`/principal and stable ID.
2. In the same Dexie read-write transaction as the write, look up the existing row by primary ID and its logical identity key.
3. If there is no match, insert.
4. If the operation is an explicit `update`/`upsert` and the caller identifies the existing row, validate and update that row; do not reinterpret it as a new create.
5. If a create repeats an ID and canonical fields match, return an `already-present`/idempotent result without replacing timestamps or fields.
6. If a create repeats an ID but meaningful fields differ, reject with a typed `DuplicateConflictError`; preserve the old row and report both safe IDs and differing field names.
7. A natural-key match without a stable identity is only a conflict candidate. Do not merge or drop it automatically.
8. `bulkUpsert` must preflight the entire batch for duplicate IDs and logical identities before any write; conflicting records abort the full batch/transaction.

This keeps current repository APIs and data models; it hardens the implementation of existing create/upsert/bulk boundaries. Existing explicit `upsert` calls remain updates when they identify the same canonical ID. Store create actions must not route to an update/upsert operation without first expressing create intent.

### 2.2 Domain-specific identities and conflict policy

| Repository/domain | Hard identity and logical uniqueness | Duplicate handling | Merge policy |
|---|---|---|---|
| Moment | Same principal + canonical `id`; retain `firestoreId` only as source lineage. Name/date/type/recurrence is a candidate key, not a guaranteed unique key because the user may create two similar moments. | Same ID/content is no-op; same ID/different content rejects. Similar moments with different IDs are preserved and may be reported as possible duplicates. | No field-level merge. User/migration conflict policy must choose a record explicitly; preserve original source evidence. |
| Activity | Same principal + `id`; parent relation is `momentId`. Same parent/title/date can identify a candidate but is not sufficient to collapse two checklist items. | Same ID/content is no-op; same ID/different content rejects; same candidate tuple with different IDs stays separate unless explicit migration dedupe resolves it. | No merge of completion, cancellation, priority, or description fields. Explicit update replaces one identified activity. |
| Memory | Same principal + `id`; must reference a Moment. Identical text can be a separate memory at a different time or moment. | Same ID/content is no-op; conflicting same ID rejects. Text similarity alone never deduplicates. | No content concatenation or field-level merge. Preserve memory body exactly on explicit update. |
| Attachment | Same principal + `id`; must reference a Moment. If a stable content hash/reference is present, use it only as a candidate identity. Filename/size alone is not identity. | Same ID and same metadata/reference is no-op; same ID with changed reference/MIME/size rejects. Same file name with another ID is retained. | Do not merge file references or claim bytes exist; explicit metadata update replaces only the identified attachment record. |
| Expense | Same principal + `id`; optional canonical identity includes `momentId`/`activityId`. Exact source ID and exact financial content can identify a migration duplicate. | Same ID/content is idempotent; same ID with changed amount/date/owner/parent is a conflict unless caller explicitly invokes update/upsert for that ID. Do not fuzzy-match amounts. | Never average/sum/merge duplicate expenses. One explicit user update replaces one row. Candidate duplicate with another ID stays separate and is reported to avoid losing money data. |
| Income | Same principal + `id`; recurring income on different dates is distinct. | Same ID/content is idempotent; conflicting same ID rejected for create. Exact tuple match with different IDs is only a candidate, not a dedupe decision. | Never aggregate or collapse recurring income rows. Explicit update requires the identified ID. |
| Settings | Same principal + `key` is the logical unique identity; the current compound index is not declared unique and the setter can create random-ID rows for the same key. | All writes for a key must resolve to one canonical row. Same value is idempotent; different value through explicit update is accepted; duplicate physical rows are quarantined for deterministic repair. | Keep the explicitly selected value. For existing duplicate rows, auto-collapse only if serialized values match; if values differ, use a conflict requiring approval rather than choosing the first query result. |
| Code Lists | Same principal + `listKey` + normalized `entryValue` is the logical unique identity; current compound index does not enforce uniqueness. | Identical metadata is idempotent; metadata differences for same logical identity are conflicts; same value with case/whitespace normalization follows one documented canonical comparison rule. | Do not merge contradictory labels, active state, greeting template, or dashboard visibility flags. Explicit edit updates the selected row. |

### 2.3 Migration and normal-runtime conflict relationship

- Reuse `migrationDeduplication.js` for **migration preview** source overlap only; it is not presently a normal repository write guard.
- Normal repository conflict checks use the same canonical fingerprint field definitions where appropriate, but an import duplicate outcome and a user CRUD conflict are distinct audit events.
- Migration policy may report `duplicate`, `already-present`, `conflict`, or `rejected` using source lineage. Normal CRUD reports `inserted`, `idempotent`, `updated`, `deleted`, or `conflict`.
- Do not add Firebase reads to resolve a local duplicate. Dexie is authoritative; Firebase remains migration/compatibility input only.

### 2.4 Merge and repair policy

- No automatic merge for mismatched records. Preserve both when their primary IDs differ; flag natural-key candidates.
- Never overwrite a mismatching existing row just because the primary key collides during `create` or bulk import.
- When legacy migration has duplicate representations, resolve them before normal runtime cutover in its preview/approval phase; retain source lineage and audit every dropped duplicate.
- Duplicate logical Settings/Code List rows must not be hidden by `.first()`. The integrity scan reports all rows grouped by logical key; identical duplicates can be collapsed transactionally, divergent rows require a conflict resolution.
- A repair must be idempotent and transactional. Snapshot affected rows before destructive dedupe; retain a repair/audit record with owner, IDs, fingerprint, decision, timestamp and outcome.

### 2.5 Audit logging

Use the existing migration audit records for migration-created conflicts. For normal runtime duplicate/conflict outcomes, use a dedicated repository-conflict audit event contract (or the existing offline audit facility if it is implemented) with:

- principal ID, domain, operation, canonical ID/logical key, outcome and conflict status;
- stable rule ID and safe field names that differed;
- before/after canonical fingerprint, not full personal/financial content;
- timestamp, store/action correlation ID, and whether a row was changed;
- no raw memory body, attachment bytes, credentials, or complete financial descriptions.

Audit failure must not cause an accepted data write to be misreported as a successful conflict-safe create. The write and its required conflict outcome should commit atomically when both use IndexedDB. Audit storage is local observability, not sync or backup.

## 3. Browser Validation Strategy

### Environments and instrumentation

Run against the production build served from a secure origin and a disposable test principal/database. Cover current supported Chrome/Edge and Firefox desktop versions plus current macOS Safari; retain a separately documented iOS matrix. For each run record app build, schema version, browser/OS version, database name/version, service-worker controller/version, principal type, offline method, and timestamps.

Instrument:

- outgoing network requests (including fetch, XHR, WebSocket/Firestore transport);
- IndexedDB transactions and success/abort outcomes;
- store/repository operation results and read-after-write values;
- console errors, unhandled rejections, service-worker events and page reloads;
- duplicate conflict/audit findings and relationship audit results.

Use both browser-level request blocking/offline emulation and, where possible, operating-system network disablement. `navigator.onLine` alone is not evidence of no connectivity.

### Browser refresh test

1. Load the production app online once so the service-worker shell and chunks are installed/cached.
2. Sign into a test account or enter Guest mode; create one synthetic row per domain and linked Moment→Activity→Expense/Moment→Memory/Attachment records.
3. Confirm successful repository writes and exact IDs/relationships.
4. Set browser context offline; capture request log and refresh from the dashboard, a direct nested route and settings.
5. Verify app shell, principal data hydration and all records from Dexie; run integrity audit; perform one more CRUD operation.
6. Refresh again and compare checksums/counts.

**Pass:** no required cloud request, no localStorage business fallback, no in-memory-only value, no duplicate rows or broken links.  
**Fail:** refresh requires network, data disappears, UI reports success before commit, or a legacy source silently fills empty Dexie results.

### Browser restart test

1. Use a persistent browser profile (not incognito); create/commit synthetic records and close the browser process completely.
2. Disable network before relaunch; reopen the installed site/PWA and verify DB version/metadata, user principal, records, settings and relationships.
3. Run repository reads and one create/update/delete; close/relaunch and verify the resulting state again.
4. Repeat with OS/browser restart where automation permits.

**Pass:** committed rows survive process restart and all operations still use Dexie.  
**Fail:** only Zustand state survives, IndexedDB opens empty, metadata mismatch goes undetected, or normal CRUD makes remote calls.

### Multi-tab test

- Open two tabs from the same origin/profile and same principal.
- Tab A creates a Moment and child records; Tab B performs a repository reload/visibility refresh and sees the committed rows.
- Both tabs concurrently attempt create with the same primary ID and same content: one durable row, second outcome is idempotent/no-op.
- Repeat with same ID and differing content: exactly one row remains unchanged by the rejected second create; conflict audit exists.
- Concurrent updates to one Settings key and one Code List logical key: no duplicate logical rows; stale update is detected or follows the explicit last-writer/conflict policy, never silently forks values.
- Parent delete versus concurrent Activity/Expense creation: transaction order must either complete the child before a consistent cascade or reject the child because parent no longer exists; no orphan.
- Close one tab during an in-flight write and verify atomic commit/abort outcome from the other tab.

**Pass:** IndexedDB transactions serialize conflicting writes, each operation has a deterministic outcome, and reloaded state has no duplicate/orphan.  
**Fail:** lost updates, same-ID replacement during `create`, duplicate Setting/Code List logical rows, stale in-memory state presented as committed, or orphaned child rows.

## 4. Safari and iPhone PWA Validation

### Device matrix

- Physical iPhone running the current supported iOS/Safari release and at least one device on the oldest supported iOS release.
- Test both the Safari browser tab and the installed Add to Home Screen (A2HS) standalone PWA.
- Add one iPad Safari/A2HS run if iPad is a supported product target; report separately from iPhone evidence.
- Private browsing is an explicitly unsupported/limited durability profile unless repeated device evidence proves IndexedDB persistence there. Do not infer behavior from desktop Safari.

### Install → offline → relaunch journey

1. Install/visit online, allow shell precache and verify the worker controls the origin. Add LifeHub to Home Screen via Safari.
2. Sign in while online or enter Guest mode and establish the intended local principal. Create the full synthetic domain/relationship fixture.
3. Verify IndexedDB read-after-write before any success state is shown.
4. Enable device Airplane Mode and disable Wi-Fi/cellular explicitly. Force-quit the PWA; relaunch from the Home Screen.
5. Verify standalone shell, direct route navigation, Dexie open, owner isolation, all rows and links; run one CRUD per domain while offline.
6. Force-quit, restart the iPhone, keep it offline, relaunch, refresh from Safari, and compare record checksums/counts.
7. Re-enable network and confirm no surprise Firebase CRUD/merge occurs; legacy migration remains explicit and sources remain unchanged.

### Additional Safari conditions

- Low available storage/quota pressure: transaction must either commit fully or fail with no partial row set; no automatic user-data purge.
- Background/foreground, screen lock, memory-pressure app termination, low-power mode, tab eviction and OS restart.
- Service-worker waiting update, accepted update, interrupted update and offline launch after activation; verify the new cache is complete before it becomes active and IndexedDB contents are untouched.
- Clear only HTTP/service-worker cache: shell may need online reacquisition, but IndexedDB must remain intact.
- Clear all Safari website data: treat as destructive; do not claim offline data recovery. Confirm app reports data unavailable instead of silently showing a successful empty state.
- Capture device model, iOS build, Safari/PWA mode, app/build ID, `db.verno`, worker/cache version, storage estimate/API support, offline procedure and evidence screenshots/logs.

### Acceptance and failure criteria

**Pass:** installed shell relaunches offline after initial install; Dexie data survives browser refresh, PWA force-close/relaunch and device restart; each acknowledged write survives; schema/metadata validates; no remote CRUD; relationships and ownership remain correct.

**Fail:** A2HS install or route chunk unavailable offline; protected app blocks on Firebase for local data; saved record disappears after process restart; iOS termination loses an acknowledged write; update corrupts/deletes Dexie; low quota causes partial writes; clear-cache unexpectedly clears IndexedDB; tests report private-mode durability without evidence.

## 5. Deliverable 6B Revalidation Plan

### Revalidation sequence

1. Correct and retest schema metadata synchronization for fresh DB, populated v1→v2 upgrade, missing schema metadata, malformed metadata, and unsupported future value.
2. Add/verify duplicate guards for every repository operation and multi-tab transaction race; rerun migration duplicate preview and normal runtime conflict policy tests.
3. Run all automated repository/store integration and failure/integrity tests with fetch blocked and legacy source writes instrumented.
4. Run full Node regression suite and production build; retain test artifacts/build ID.
5. Run desktop browser refresh/restart/multi-tab tests using a persistent profile and offline request block.
6. Run physical iPhone Safari and A2HS tests from the device matrix; this is required before final certification.
7. Reconcile test outcomes against source ownership and any not-yet-run Deliverable 5 migration. Never treat a user with unimported legacy sources as offline-ready merely because their Dexie database is empty and valid.

### Success criteria

- `db.verno`, `DATABASE_SCHEMA_VERSION`, and `metadata.schemaVersion` agree after every supported boot/upgrade; metadata is repaired without resetting data-migration state.
- All eight domains pass create/read/update/delete and repository reload with network unavailable.
- Same-ID identical create is an idempotent no-op; conflicting same-ID create is rejected and audited; explicit update works; batch conflict is atomic.
- Logical unique Settings/Code List records do not multiply across repeated writes or multi-tab writes.
- Moment→Activity/Memory/Attachment and Activity→Expense relationships survive close/reopen/refresh/relaunch with no orphan findings.
- Guest and authenticated principal data are isolated across tab, refresh and relaunch.
- Corrupt rows and missing parents are detected; invalid IDs/values are rejected or surfaced as explicit conflicts; no silent mapper normalization hides a data-integrity failure.
- Desktop persistent-profile refresh/restart/multi-tab and physical iPhone Safari/A2HS offline tests pass with zero required remote domain calls.
- Full regression suite and production build pass; no Sync, backup, cloud integration, architecture redesign or repository API redesign was added.

### Pass/fail reporting rules

- **Pass:** every success criterion has automated or documented device evidence with build/environment identity.
- **Conditional pass:** automated fake-IndexedDB/browser-emulation tests pass, but one or more physical-browser/PWA steps remain unexecuted. Must not be called fully offline-certified.
- **Fail:** any metadata mismatch, conflicting duplicate overwrite, partial transaction, owner leak, orphan, required Firebase CRUD call, persistence loss after refresh/restart, or build/test failure.
- Record test failures rather than weakening assertions or treating expected defect characterization as a successful integrity check.

## Implementation boundary

Deliverable 6C is a remediation specification. It does not authorize an architecture change, data-model redesign, sync, backup/restore UI, or automatic migration execution. The next implementation should address only the three blockers, then rerun the specified validation gates.
