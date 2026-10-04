# Sprint 2 — Deliverable 5: Migration Framework Specification

**Status:** Implementation specification only — no code or repository behavior is changed by this document.  
**Scope:** One-time import of legacy LifeHub data into the approved Dexie repositories.  
**Not in scope:** Sync, Firebase writes, Cloud Storage integration, Backup/Restore UI, deletion of legacy data, or repository/data-model redesign.

## Governing decisions

This design treats the following as approved and fixed:

- Dexie is the canonical local source of truth after a successful import.
- Firebase and legacy localStorage are read-only migration sources. The migration framework must not write to, delete from, or mark records in either source.
- The existing Settings, Code List, Expense, Income, Moment, Activity, Memory, and Attachment repositories and their canonical models remain the write boundary. Migration code may call their approved write methods inside a shared Dexie transaction; it must not create a competing persistence path.
- The migration state machine is the approved state set in this document. Migration is idempotent and restartable by run; a failed run does not mean that a source was changed.
- Every source record is either imported, deterministically recognized as a duplicate, or retained in a conflict/rejection report. No unreported silent drops.

> **Important integration gate:** `AuthContext` currently invokes `mergeGuestDataIntoAccount`, which writes guest records to Firestore and removes guest localStorage keys. That behavior is incompatible with the approved source-of-truth policy and can destroy migration inputs before the local import. Deliverable 5 implementation must gate/replace that legacy flow before migration is enabled. Its replacement must move data only within Dexie and must not perform background cloud writes.

## 1. Current data sources review

### Ownership and source matrix

| Source | Current shape / location | Ownership | Risks | Complexity |
|---|---|---|---|---|
| Firebase `users/{uid}/eventGroups` | Firestore documents normalized by `eventService`; each event may embed activities, memories, attachments, greeting card data, and activity expenses | Account-owned by Firebase `uid`; each document also has a Firestore document ID and often an application `id` | Parent and child records are embedded; child identity may not match Firestore identity; nested expenses overlap with the master expenses collection; timestamps/optional fields vary; attachment URLs may refer to external content unavailable to this migration | High: flatten children, preserve parent relationships, retain greeting card and recurrence/status semantics, detect nested/master duplicates |
| Firebase `users/{uid}/expenses` | Firestore documents; `expenseService` also reads expenses nested under event activities | Account-owned by Firebase `uid` | Same logical expense can appear in both source locations; fields may use `event_id`/`activity_id`; current reads merge largely by `id`/`firestoreId`; no safe heuristic for fuzzy financial deduplication | High: exact identity mapping plus conservative overlap resolution |
| Firebase `users/{uid}/incomes` | Firestore documents normalized by `incomeService` | Account-owned by Firebase `uid` | `addDoc` document ID is separate from application `id`; optional description/timestamps; same-looking recurring transactions are not necessarily duplicates | Medium |
| `lifehub_guest_eventGroups` | JSON array of normalized-ish event groups; nested activities, memories, attachments, and expenses | Browser-local guest profile; not inherently owned by the currently signed-in user | JSON corruption/truncation; global browser key can contain data from the prior guest session; embedded nested records; guest/account overlap; record counts can be large | High |
| `lifehub_guest_expenses` | JSON array; duplicates may also exist within `lifehub_guest_eventGroups[].activities[].expenses[]` | Browser-local guest profile | Direct and nested records can overlap; malformed payloads and duplicate IDs; current service merges data before returning it | High |
| `lifehub_guest_incomes` | JSON array | Browser-local guest profile | Corrupt JSON; records may lack stable timestamps/IDs; ownership ambiguous if browser profile is shared | Medium |
| `lifehub_preferences` | JSON object read at startup and persisted by app state | Browser/device preference scope in current implementation | Invalid JSON; partial preferences; unknown keys; a device preference is not necessarily appropriate to transfer to an account | Low–medium |
| `lifehub_theme_choice` | Presence/value marker used alongside `lifehub_preferences.theme` | Browser/device theme-selection marker; not an independent theme value | Legacy marker can disagree with preferences; cannot treat marker text as canonical theme | Low |
| `lifehub_admin_values` | JSON object of configurable list values; also consumed as code-list metadata | Browser-local configuration, possibly user-maintained | May be strings or objects with metadata; defaults can be merged by the current adapter, which risks confusing defaults with stored user data; invalid/non-array list entries | Medium |
| `lifehub_admin_values_schema_version` | Numeric/string version marker | Metadata for the local admin-values format | Missing or malformed version; old versions may not support current fields | Low–medium |

### Source boundary and evidence

- Firebase data is currently accessed via Firestore collections in `eventService.js`, `expenseService.js`, and `incomeService.js`; `eventGroups` is the only listed source for moments and embedded child domains. There are no separate Firestore collections for activities, memories, or attachments in the reviewed implementation.
- Guest data is read from the listed keys by the legacy adapters. Expenses specifically have both a direct list and nested event/activity copies.
- Settings and configurable lists are read from localStorage. Firebase is not a source for these domains in the current implementation.
- Current `settingsLegacyAdapter` returns the legacy values, while `codeListLegacyAdapter` merges stored values with defaults. Import discovery must separately record whether the key existed and import only values actually present in that key; defaults are seeded by the normal code-list bootstrap, not represented as migrated user choices.
- Current domain mappers can fill missing values and may generate random IDs. Migration must validate raw values before lossy defaulting and must supply deterministic IDs where a source lacks one before invoking the canonical mapper. Preserve all raw source records in the snapshot and audit evidence.

### Complexity and safety implications

1. Read every source to a stable in-memory/staging snapshot before writing the canonical target.
2. Capture source fingerprints/counts and source read errors. An unavailable Firebase source is not equivalent to an empty source; it blocks a Firebase-complete run.
3. Never clear, rewrite, or mutate legacy source keys after import. Legacy cleanup is a later, separately approved operation.
4. Do not classify a malformed or inaccessible source as successfully migrated with zero records.
5. Do not infer that local guest data belongs to an account merely because that account signs in on the same browser.

## 2. Migration framework design

### Component responsibilities, interfaces, dependencies

All interfaces below are conceptual contracts, not generated code. Result objects should include `runId`, state, counts, warnings/errors, and per-domain outcomes.

#### `MigrationCoordinator`

**Responsibility:** Orchestrate one migration run, enforce the state transitions, coordinate preview/consent, snapshots, dataset import, validation, atomic Dexie commit, audit, and safe failure handling.

**Conceptual operations:**
- `start({ principal, sourceSelection, migrationVersion, mode })` — create a run and inspect eligible sources.
- `preview(runId)` — return counts, transformations, duplicates, conflicts, rejects, and estimated snapshot size; no canonical writes.
- `commit(runId, approvedPreviewToken)` — recheck source fingerprint, acquire the migration lock, write prepared data atomically, validate committed state, finalize ledger/audit.
- `rollback(runId, reason)` — restore the run's target snapshot when a commit occurred or a partial target mutation is detected.
- `getRun(runId)` / `getHistory(principal)` — expose status and history for application orchestration and support.

**Dependencies:** `MigrationRegistry`, source adapters, canonical mappers and validators, domain repositories, `MigrationValidator`, `MigrationSnapshotManager`, `MigrationRollbackManager`, `MigrationAuditLog`, Dexie transaction/lock coordinator, clock/ID provider, and optional user-consent callback. Firebase source adapter uses the existing Firebase Firestore SDK read APIs only.

#### `MigrationRegistry`

**Responsibility:** Register immutable, versioned data-import definitions independently of Dexie schema migrations.

Each definition declares: `migrationVersion`, supported source adapters, domain order, raw-reader, mapper, row validator, relationship validator, deduplication strategy, repository writer, idempotency key strategy, compatibility rules, and required post-import checks. Registry lookup must reject unknown versions and prevent a second completed execution for the same principal/source fingerprint/version unless explicitly forced as a new run.

**Boundary:** Existing `src/migrations/registry.js` is a schema-registration scaffold. Do not conflate schema-version upgrades with user-data import definitions; either preserve its schema role and add a data registry, or extend it without changing the meaning of schema migrations.

#### `MigrationValidator`

**Responsibility:** Apply the validation layers defined in section 8 to raw records, mapped/staged data, and committed rows. Return structured findings with severity (`error`, `warning`, `info`), source/domain/record identity, rule ID, and safe user-facing message. Errors block commit; warnings require explicit preview acknowledgement if data fidelity could be affected.

**Dependencies:** Domain validator functions, canonical repositories for committed reads, and cross-domain relationship/deduplication checks.

#### `MigrationSnapshotManager`

**Responsibility:** Create, verify, retrieve, expire, and mark a durable snapshot of all affected Dexie target rows before any canonical write.

**Operations:** `create(runId, principal, affectedTables)`, `verify(snapshotId)`, `load(snapshotId)`, `markRestored(snapshotId)`, and `expireEligible(now)`. Snapshot payload must be checksummed and size/quota-checked before the run proceeds.

#### `MigrationRollbackManager`

**Responsibility:** Restore the exact pre-run target state from the durable snapshot using an all-affected-tables Dexie transaction, verify restored counts/checksums, and record the result. It never writes to Firebase or localStorage.

**Operations:** `rollback(runId, snapshotId)`, `verifyRestoration(runId)`, and `recoverIncompleteRollback(runId)`.

#### `MigrationAuditLog`

**Responsibility:** Persist append-only run history, per-domain counts, source lineage, validation findings, conflicts, duplicate decisions, failures, commit outcome, and rollback evidence. Auditing must not store secrets, full financial descriptions, or attachment contents unnecessarily; the protected snapshot retains data required for recovery.

**Operations:** `beginRun`, `appendEvent`, `recordDecision`, `completeRun`, `failRun`, `recordRollback`, and `readHistory`.

#### Source adapters and writers

- **Firebase adapter:** Read the authenticated user's three Firestore collections and embedded data only after auth establishes the matching `uid`. Preserve Firestore document path and ID. No Firebase write/delete APIs.
- **Guest adapter:** Parse guest keys defensively and return both source presence and parse status. No writes/removes.
- **Settings adapter:** Capture raw key presence and values, parse separately, and preserve original raw strings in the snapshot.
- **Dexie target reader:** Capture only rows owned by the migration principal in affected canonical tables, plus migration state required for idempotency.
- **Repository writer:** Call the existing repository bulk/set operations for all canonical data, within one outer Dexie read-write transaction. If an existing repository method cannot participate in a shared transaction or preserve deterministic IDs, that is an implementation gate requiring a narrowly scoped additive repository integration change—not a second writer or model redesign.

### Transaction and atomicity boundary

- Import preview and staging must not change canonical rows.
- Snapshot creation must finish and pass checksum/quota verification before target writes.
- The entire canonical multi-domain write, migration-run status transition, and final validation/ledger update must be covered by a Dexie transaction over all affected tables. On transaction failure, IndexedDB atomicity must leave the prior canonical rows intact.
- Where platform limits make an all-domain transaction impractical, import into migration staging tables first and perform a bounded atomic promotion. Never expose partially imported canonical data as completed.
- The source fingerprint is checked again immediately before commit. If a source changes between preview and commit, invalidate the approval token and return to `CheckingSource`/a new preview; do not import stale preview silently.

## 3. Migration state machine implementation design

Only the approved states are used. A run records every transition with timestamp, actor/principal, source fingerprint, and cause.

| State | Purpose | Entry criteria | Exit criteria | Validation requirements | Failure handling |
|---|---|---|---|---|---|
| `NotStarted` | No active migration run has started | New principal/session, or explicit new run; no active lock | Run ledger created; migration definition and principal resolved; proceed to `CheckingSource` | Supported migration version; active principal; source selection is explicit; no conflicting active run | Record a failed start with reason if configuration/principal is invalid; no data mutation |
| `CheckingSource` | Discover and read candidate source data without target writes | Run ledger exists | Every selected source has read status/fingerprint/count; eligible datasets classified; proceed to `SnapshotCreated` only if source reads are complete enough for the selected migration | Firebase authorization and read success; localStorage parse/type checks; expected collection/key presence; no source treated as empty on read error; raw record bounds | Fail closed for inaccessible selected sources; report source-specific fault; retry as a new run after recovery |
| `SnapshotCreated` | Protect pre-import Dexie state | Source scan is complete; target domain rows identified | Durable snapshot persisted, checksummed, reload-verified; proceed to `ImportPreview` | Snapshot includes every affected table/principal row and relevant indexes/ledger state; snapshot count/checksum matches reads; quota and capacity sufficient | Block import if snapshot absent, corrupt, incomplete, or over quota; target remains unchanged |
| `ImportPreview` | Present planned transformations and consequences before commit | Snapshot verified and source scan stable | User/app approves exact preview token; proceed to `Importing` | Per-domain source/import/duplicate/conflict/reject counts; unresolved destructive ambiguity blocks approval; validate preview token against run and source fingerprint | Cancel leaves sources and canonical data unchanged; stale source or expired snapshot causes re-check/re-preview |
| `Importing` | Transform records and stage proposed canonical writes | Preview approved; run lock held | All staged records have deterministic IDs and lineage; proceed to `Validating` | Mapper output shape; canonical row validation; no writes to final domain tables at this stage; stage write checksum and count | Any transformation/staging failure marks run `Failed`; discard staging only after evidence is logged; keep source and canonical rows untouched |
| `Validating` | Run all row, relationship, business, dedupe, and migration-level checks | Staging complete | Zero blocking errors, accepted warnings, and consistent staged counts; proceed to `CommitReady` | Section 8 gates; cross-domain parent-child integrity; duplicate/conflict decision records; source and staged count reconciliation | Blocking finding -> `Failed`; do not commit. Preserve findings and staging reference long enough to diagnose/retry |
| `CommitReady` | Last pre-write gate and atomic commit boundary | Staged dataset passed validation; approval still valid | Snapshot reverified; source fingerprint unchanged; commit transaction succeeds and read-after-write checks pass; proceed to `Completed` | Migration lock owned; snapshot intact; no completed ledger for same idempotency key; all repository writes accepted; post-write row counts/relationships/checksums match | Any transaction or post-write check failure -> `Failed`; transaction rollback is automatic where possible, then explicit rollback manager verifies snapshot restoration |
| `Completed` | Migration committed and verified | All affected data and ledger committed atomically; post-commit validation passes | Terminal; optional user-requested explicit rollback transitions to `RolledBack` only while snapshot retained and policy permits | Counts and audit finalization present; completed run idempotency marker durable | Audit-finalization failure must not mask the committed result; record recoverable audit fault and repair on next boot without re-import |
| `Failed` | Run did not meet a required gate or commit/verification failed | Any state encounters a fatal error | Terminal for this run, or enter `RolledBack` if any canonical target mutation might have occurred and restoration is requested/required | Failure stage, error class, affected domains, mutation certainty, and snapshot status recorded | Never report `Completed`; preserve sources; if target state is uncertain, lock affected user data until rollback verification completes |
| `RolledBack` | Target state restored to its pre-run snapshot | `Failed` after possible mutation, or an explicit rollback of a completed run within retention | Terminal; a retry uses a new run ID and rechecks all sources | Restored row counts/checksums exactly match pre-run snapshot; rollback event links to original run; sources still unchanged | If restore fails, retain snapshot, mark recovery-needed in audit, block further migration for that principal, and provide clear retry/support instructions |

### Allowed transition graph

- Normal path: `NotStarted → CheckingSource → SnapshotCreated → ImportPreview → Importing → Validating → CommitReady → Completed`.
- A fatal error from any active state transitions to `Failed`.
- `Failed → RolledBack` is required only when a mutation may have occurred or the canonical target is uncertain; otherwise the run remains `Failed` with source and target verified unchanged.
- `Completed → RolledBack` is permitted only for a deliberate, audited rollback while the retained snapshot is valid. It is not automatic and must not silently run because newer local edits exist.
- No implicit transition from `Failed` back to an active state. A retry gets a new `runId`, rechecks source data, and relies on deterministic idempotency/deduplication.

## 4. Dataset migration design

### Common processing contract

For each selected source: read raw → retain raw snapshot/fingerprint → validate raw shape → add source lineage and deterministic missing identity → canonical mapper → row validation → deduplicate/resolve conflict → validate relationships → preview → write via repository within shared Dexie transaction → read-after-write validate. Each decision is auditable.

For all rows store migration lineage in migration audit/ledger rather than relying on a new domain-field redesign: `source`, `sourcePath`, `migratedAt`, `migrationVersion`, `originalId`, and `outcome`. Canonical `id`, `userId`, parent IDs and canonical fields remain the approved repository model.

| Domain | Source data shape | Transformation rules | Validation rules | Rollback requirements | Deduplication rules |
|---|---|---|---|---|---|
| Settings | `lifehub_preferences` JSON object; theme marker; admin values and schema version | Import only keys actually stored, not adapter-injected defaults. Convert preferences into settings entries using the approved settings mapper. Treat `lifehub_theme_choice` as a legacy marker; use validated `preferences.theme` as value, and record disagreement. Keep source/key provenance. Apply device preference to guest principal by default; transfer to account only under the approved explicit account-import choice and never overwrite a user-edited Dexie value silently. | Object/non-array checks; allowlisted known fields and supported value types; valid theme enum; malformed individual keys are rejected with findings while valid siblings can preview. Verify no JSON parse error was mistaken for empty preferences. | Snapshot all settings rows for target principal; rollback restores prior rows, including settings absent before import. Source strings remain unchanged. | Same principal + settings key is same logical row. Existing Dexie wins unless user explicitly approves overwrite; equal values are a no-op. Never dedupe different setting keys by value. |
| Code Lists | `lifehub_admin_values` object with list values as strings or metadata objects; schema version | Use stored values only; normalize string entries to `{value,label}` form through the canonical code-list mapper; preserve active flags, greeting metadata, dashboard visibility flags, and custom templates when valid. Do not import built-in defaults as user data. Record legacy schema version for version-aware transformation. | List key must be supported/allowed; list values must be arrays of supported entry forms; entry values non-empty and unique within list; booleans/templates type-checked; invalid entries become conflict/reject findings. | Snapshot target user's code list rows before any replacement/upsert; restore exact rows on rollback. | Identity is target principal + listKey + normalized entryValue. Exact matching metadata is duplicate; metadata differences are conflict, not duplicate. Existing Dexie choice is preserved unless preview explicitly resolves it. |
| Expenses | Firebase `users/{uid}/expenses`; expenses nested at event activity `expenses[]`; guest direct expense key plus nested event/activity expenses | Flatten master and nested expense records into one canonical expense dataset; normalize `eventId`/`event_id`, `activityId`/`activity_id`, and set `momentId` from event relation; retain origin path and both source IDs. Do not discard nested expense evidence. | Required canonical identity/owner/name/category/date; finite nonnegative amount; date parse; linked activity must link to a valid moment; missing parent is an error or an explicitly approved orphan conflict, never silently nullified. | Snapshot all target-user expense rows and any affected relationship rows; transaction/rollback must restore exact expense set and links. | Exact source path + original ID; then shared application ID/firestoreId across master/nested copies; then exact canonical tuple (owner, parent, activity, normalized date, amount in minor currency units, normalized name/category/description) may be deduplicated only when all substantive fields agree. Same tuple with conflicting amount/description is a conflict. Do not fuzzy-match money records. |
| Income | Firebase `users/{uid}/incomes`; guest income JSON array | Normalize amount/date/name/type/description; preserve Firestore doc ID as `firestoreId` and application `id` separately; attach owner/source lineage; use deterministic source-derived ID when source has neither. | Required canonical ID/owner/name/type/date; finite nonnegative amount; date/time validity; strings normalized without losing raw source values from snapshot. | Snapshot target-user income rows; restore exact prior set transactionally. | Exact source path + original ID, then application ID/Firestore ID; fallback exact tuple (owner, normalized date, amount in minor units, normalized name and type, normalized description). Similar amounts/names without exact tuple remain separate or conflict candidates; recurring payments must not be collapsed based only on date/amount/type. |
| Moments | Firebase `eventGroups` Firestore docs; guest event-group array | Flatten each event group into a Moment; preserve Firestore document ID, application ID, notes, budget, type/custom type, recurrence, status, greeting card, created/updated timestamps and owner. Preserve current event-status behavior; do not recalculate in migration unless the canonical status contract requires it. Child arrays are staged separately and parent IDs mapped first. | Required canonical ID/owner/name/date/type; valid date and supported recurrence/status; finite nonnegative budget; greeting-card shape; parent identity unique. Invalid dates/statuses must be flagged, not silently replaced with today's date/default active. | Snapshot moments plus all child domains and expenses whose relationships could be affected; restore all linked rows in the same rollback operation. | Exact Firestore path/document ID or application ID; otherwise exact normalized tuple (owner, name, date, type, recurrence). Matching tuple with different substantive fields is a conflict. Same-name same-date moments are not auto-merged absent a stable identity. |
| Activities | `eventGroups[].activities[]` in Firebase and guest event-group storage | Flatten into activity rows after resolving parent Moment; translate `eventId` to canonical `momentId`; preserve title/date/description/completion/cancellation/priority/completedAt/createdAt. Extract nested expenses as the independent Expense dataset while retaining `activityId`. | Required activity ID/owner/moment ID/title/date; parent moment must exist in the same owner scope; completion flag/timestamp consistency checked; supported priority and valid date. | Snapshot activities plus associated moments and expenses; rollback restores the full relation set. | Exact source parent path + activity ID; then owner + parent + application activity ID; fallback exact tuple (owner, parent ID, title, date, normalized description, completion state). Conflicting completion/status data is a conflict, not a duplicate. |
| Memories | `eventGroups[].memories[]` in Firebase and guest event-group storage | Flatten memories from each parent moment; map eventId to momentId; preserve title/content/kind/createdAt/updatedAt and any recognized legacy text aliases. Unknown fields remain available in the source snapshot and appear in preview warnings until an approved canonical mapping exists. | Required identity/owner/moment relation; at least one meaningful title/content field; serializable data; valid timestamps if supplied; parent must exist. No silent truncation or substitution of memory content. | Snapshot memory rows and associated moments; restore all rows exactly. | Exact parent path + original memory ID; then app ID; fallback exact tuple (owner, parent ID, normalized title, normalized content, createdAt). Same text at different times is not automatically duplicate. |
| Attachments | `eventGroups[].attachments[]` in Firebase and guest event-group storage; metadata/reference only | Flatten metadata, map eventId to momentId, preserve name, MIME/type, size, URL/reference, timestamps and original source path. Do not download files, upload to Cloud Storage, rewrite remote references, or assume a URL remains reachable. If record contains inline binary/base64 data, mark as unsupported/size risk and require explicit resolution rather than silently stripping it. | Required identity/owner/moment/name and supported reference shape; nonnegative finite size; safe URL/reference format; parent exists. Validate that migration does not copy file bytes into audit logs. | Snapshot canonical metadata rows. Existing attachment content remains where its source stores it; no external file is deleted or changed. | Exact source path + ID; then stable file reference/hash if already present; fallback exact tuple of parent, normalized name, MIME, size, and URL. Same filename/size is not enough to collapse different references. |

### Processing order

1. Settings and code lists (they have no event-child dependencies).
2. Moments.
3. Activities.
4. Expenses (after moments/activities are mapped; includes master and nested copies).
5. Income.
6. Memories and Attachments.
7. Cross-domain validation and a final per-principal integrity scan.

The shared Dexie transaction may batch writes in a different operational order only if foreign-key validation still uses the complete staged set and the final commit remains atomic.

## 5. Duplicate detection design

### Deterministic decision levels

1. **Same origin identity:** same source kind + Firestore document path or localStorage key/index + stable original ID. This is the strongest duplicate key.
2. **Same cross-source application identity:** same canonical application ID and same owner scope, with matching parent identity where applicable.
3. **Exact canonical content fingerprint:** normalize only approved comparison fields; use stable JSON serialization and a cryptographic hash. Dates, decimal money values, and strings must use canonical normalization. Do not include generated timestamps/IDs.
4. **Conflict candidate:** similar but not exact content or a shared ID with different substantive data. Never silently drop; create a conflict entry and require deterministic policy/preview resolution.

If a source has no ID, derive a stable migration ID from source namespace + source path/key + stable record ordinal or a deterministic hash of raw canonicalizable content. Never use `crypto.randomUUID()` as the only migration identity: rerunning after interruption must produce the same target ID.

### Domain rules

- **Expense:** Deduplicate the known Firebase master-vs-nested / guest direct-vs-nested overlap by matching source/application identity, with exact-content confirmation when identities are ambiguous. Exact financial fingerprint includes owner, parent/activity IDs, date, amount represented in currency minor units, name, category, and description. A mismatched amount or parent is always a conflict.
- **Income:** Exact identity first; otherwise exact fingerprint on owner, date, minor-unit amount, name, type, and description. Same amount/type on different dates remains separate. No approximate amount tolerance.
- **Moment:** Exact Firestore/application identity first; otherwise exact fingerprint on owner, name, date, type, recurrence. Same-name same-date entries with differing notes, status, greeting card, budget, or ID are reviewable conflicts, not auto-discarded.
- **Activity:** Exact parent + source/application identity; fallback uses owner, parent, title, date, description, completion/cancellation, priority. Expenses are independently deduplicated and must preserve activity relationship.
- **Memory:** Exact identity first; fallback exact normalized parent/title/content/timestamp. Do not merge just because content matches if timestamps or parents differ.
- **Attachment:** Exact source identity or exact file reference/hash plus parent. Filename-only matching is prohibited.
- **Guest/User overlap:** Never infer ownership transfer from equal fields. Guest-owned rows remain separately owned unless the user explicitly approves an account-local merge. For a deliberate merge, exact same source/application identity and exact content can become one target row with multiple lineage origins; conflicting content is retained as a separate deterministically namespaced row or blocked for user resolution. Do not write the merge to Firebase.
- **Firebase/Dexie overlap:** Dexie is canonical and is not overwritten by a legacy Firebase snapshot on conflict. Equal canonical values are recorded as an already-present duplicate. If a Firebase record has the same primary ID but different content, record a conflict; preserve both without violating primary-key uniqueness by assigning the imported conflict a deterministic migration-scoped ID and preserving the original ID in the ledger, or block for explicit user resolution. Never silently choose `updatedAt` unless timestamps are valid and the approved conflict policy expressly authorizes it.

Every duplicate decision records the candidate IDs, rule ID, retained target ID, omitted duplicate's source lineage, and whether user acknowledgement was required.

## 6. Rollback design

### Snapshot structure

Each durable snapshot is keyed by `snapshotId` and includes:

- `runId`, principal/owner scope, migration version, schema version, creation time, retention expiry, state, and checksum.
- Exact pre-run rows from affected canonical tables: settings, codeLists, expenses, incomes, moments, activities, memories, attachments; any owner-scope/metadata rows that the migration will change; and relevant migration-ledger state.
- Per-table row count and canonical-content checksum.
- Source-selection and source-fingerprint metadata (not a substitute for retaining external source data; sources are not modified).
- Versioned serialization format and verification status.

Snapshots must be durable in IndexedDB, not only in React state or memory. Add migration-control storage separately from domain rows. Proposed stores are `migrationRuns`, `migrationSnapshots`, and `migrationAudit`; do not overload user domain tables. Snapshot records can contain structured-clone-compatible JSON payloads. Snapshot creation must test IndexedDB quota/space, estimated serialized size and checksum before target writes. If the device cannot fit the snapshot, migration blocks with a recoverable explanation.

### Retention policy

- Retain the pre-import snapshot for at least 30 days after `Completed`, or until the user explicitly confirms a later lifecycle policy; never expire a snapshot for a run in `Failed`, `RolledBack`, or recovery-needed state.
- Do not delete snapshots on successful migration. Expiration is a later automated maintenance action that checks no active/failed run references it and records an audit event.
- This is migration rollback retention only; it is not user-facing backup/restore or an export facility.

### Restore workflow

1. Acquire the principal migration lock and verify run/snapshot ownership and checksum.
2. Read current target rows to build a rollback precondition checksum. If canonical data changed after migration completion, stop and require conflict-safe rollback resolution; do not erase newer edits.
3. In one Dexie transaction, restore the exact table state from the snapshot (including removing only rows introduced by this migration run), update migration status to `RolledBack`, and append rollback evidence.
4. Read back all affected rows, compare table counts/checksums, verify relationships and source remains unchanged/read-only.
5. Only then release the lock and inform the caller rollback is complete.

### Failure recovery and user notification

- A failed pre-commit run reports that no existing canonical data was changed when that fact is verified.
- A failed/uncertain commit keeps the principal locked until atomic transaction rollback or snapshot restoration is verified.
- Snapshot corruption or restoration failure retains all recovery material, records `recovery-needed`, blocks another migration for that principal, and presents a plain-language message with retry/support guidance. Never claim success or rollback based on an attempted operation alone.
- Successful migration notification includes domains imported, duplicates, records requiring attention, and confirmation that Firebase/localStorage sources were preserved. Do not expose raw personal/financial data in logs or toast text.

### Audit history requirements

Snapshot create/verify/restore/expiry events include actor, timestamp, runId, snapshotId, affected tables/counts/checksums, outcome, and error class. Rollback of a completed import must be explicit and auditable; no automatic rollback may overwrite newer user work.

## 7. Migration audit design

### Ledger and event history

- **Migration run ledger:** one record per run with `runId`, principal, sources, `migrationVersion`, database schema version, state, started/updated/completed timestamps, source fingerprints, snapshot ID, summary counts, approval token/hash, and terminal outcome.
- **Migration history:** append-only event sequence per run: transition, source scan, preview approval/cancel, stage completion, validation, commit, recovery, and rollback.
- **Failure history:** failure stage, domain/source, safe error class/code, retryability, whether mutation was possible, and snapshot/recovery state. Do not persist credentials or raw stack traces containing data.
- **Conflict history:** conflict group ID, domain, canonical/source IDs, rule, field categories differing, resolution, actor/approval, and retained record identity. Avoid copying full personal contents into the audit record.
- **Deduplication history:** rule ID, candidate origin identifiers, selected target ID, outcome, and reason.

### Required metadata

Every source-record decision includes:

- `source` (`firebase`, `guest-local-storage`, `settings-local-storage`, or `dexie-existing`)
- `migratedAt` (UTC timestamp of final write/decision; null for preview-only)
- `migrationVersion`
- `originalId` (or stable source key/index token if absent)
- `outcome` (`imported`, `already-present`, `duplicate`, `conflict`, `rejected`, `rolled-back`, `skipped-by-selection`)

Also include source path/key, target domain/ID, runId, snapshotId where applicable, rule/finding ID, and source fingerprint. Audit is append-only for that run except documented status/retention metadata updates.

## 8. Validation design

| Validation layer | Checks | Gate |
|---|---|---|
| Row validation | Raw type/shape; required fields; dates; finite monetary values; safe size/reference; serializability; supported enum values; canonical mapper result; deterministic identity | Any invalid canonical row blocks that row. Preview reports all findings; unresolved required data blocks the run. |
| Relationship validation | Activity→Moment; Memory→Moment; Attachment→Moment; Expense→Moment/Activity where links exist; same owner/principal on parent and child; no duplicate target primary identity | Broken references block commit unless explicit orphan-preservation resolution is approved and the canonical model supports it. |
| Business validation | Nonnegative amounts/budgets; valid recurrence/status/priority; completed activity timestamp policy; valid settings theme/preferences; unique active code-list entries; preserve event status/greeting behavior; financial parent links consistent | Business rule errors block; allowed legacy variations become visible warnings with explicit acceptance. |
| Migration validation | Source scan completeness; source fingerprint stable since preview; supported migration version; ID determinism; staged count reconciliation; per-domain imported/duplicate/rejected totals reconcile to source totals; rerun idempotency; snapshot checksum/quota | All required-source reads complete; no unexplained count delta; no duplicate run; snapshot valid. |
| Referential integrity validation | Every canonical child reference resolves in the same principal; no cross-user links; unique ID ownership; Firestore/application ID lineage retained; no orphan from partially imported parent | Zero unresolved parent references at `CommitReady`. |
| Orphan detection | Explicit scans for activities, expenses, memories, attachments whose parent is missing; records whose owner is absent/mismatched; malformed nested arrays | Orphans are reported with source path. No silent child deletion; either correct by an unambiguous source mapping or block/require user decision. |
| Duplicate detection | Exact identity and canonical fingerprint rules in section 5; collision detection before write; compare with existing Dexie records as well as within each source | Each duplicate/collision has a persisted decision. A primary-key collision with differing content blocks or gets deterministic conflict identity under explicit resolution. |

Validation should run at three distinct checkpoints: raw source scan (`CheckingSource`), staged canonical data (`Validating`), and canonical read-after-write (`CommitReady`). The same rules and stable rule IDs must be used at all three points where applicable.

## 9. Files to create

No files below are created by this specification. Proposed implementation roster:

### Orchestration and policy

- `src/migrations/dataMigrationRegistry.js` — separate versioned data-import definitions from schema-version migrations.
- `src/migrations/migrationCoordinator.js` — run lifecycle and approved state machine.
- `src/migrations/migrationStateMachine.js` — allowed transitions and transition validation.
- `src/migrations/migrationValidator.js` — structured validation orchestration.
- `src/migrations/migrationSnapshotManager.js` — durable snapshots, verification, retention.
- `src/migrations/migrationRollbackManager.js` — safe restore and recovery checks.
- `src/migrations/migrationAuditLog.js` — append-only ledger/history/failure/conflict/dedup events.
- `src/migrations/migrationLock.js` — per-principal exclusive run/rollback lock and stale-lock recovery.
- `src/migrations/migrationRepositoryWriter.js` — coordinate existing domain repository writes inside the approved shared transaction.
- `src/migrations/migrationIdentity.js` — stable guest principal and deterministic migration IDs/source fingerprints, subject to the ownership gate below.

### Source adapters and domain plans

- `src/migrations/sources/firebaseMigrationSource.js` — read-only Firestore collection and embedded child reader.
- `src/migrations/sources/guestStorageMigrationSource.js` — read-only guest JSON reader for the three guest keys.
- `src/migrations/sources/settingsStorageMigrationSource.js` — key-presence-aware reader for the four settings/admin keys.
- `src/migrations/sources/dexieTargetSource.js` — owner-scoped pre-import target reader for snapshot and overlap detection.
- `src/migrations/datasets/settingsMigration.js`
- `src/migrations/datasets/codeListMigration.js`
- `src/migrations/datasets/expenseMigration.js`
- `src/migrations/datasets/incomeMigration.js`
- `src/migrations/datasets/momentMigration.js`
- `src/migrations/datasets/activityMigration.js`
- `src/migrations/datasets/memoryMigration.js`
- `src/migrations/datasets/attachmentMigration.js`
- `src/migrations/deduplication.js` — exact identity/fingerprint rules and decision records.
- `src/migrations/migrationPreview.js` — serializable preview, acknowledgement token and count reconciliation.

### Tests and testing utilities

- `src/migrations/testing/migrationFixtures.js` — legacy fixture builders, deterministic clock/IDs and corrupt-source cases.
- `src/migrations/testing/fakeMigrationSources.js` — controllable Firebase/localStorage/Dexie source doubles; no live cloud writes.
- `src/migrations/testing/failureInjector.js` — deterministic failure points for snapshot, each domain, commit, post-commit validation, rollback, and audit.
- `src/migrations/migrationStateMachine.test.mjs`
- `src/migrations/migrationCoordinator.test.mjs`
- `src/migrations/migrationValidator.test.mjs`
- `src/migrations/migrationSnapshotManager.test.mjs`
- `src/migrations/migrationRollbackManager.test.mjs`
- `src/migrations/migrationAuditLog.test.mjs`
- `src/migrations/deduplication.test.mjs`
- `src/migrations/datasets/*.test.mjs` — per-domain transform and validation tests.
- `src/migrations/migrationIntegration.test.mjs` — Dexie transaction, idempotency, guest and Firebase emulator/read-fixture integration coverage.

## 10. Files to modify

These are implementation changes proposed for a later coding task; no files were modified for this specification.

| Existing file | Reason | Impact | Risk / control |
|---|---|---|---|
| `src/database/tables.js` | Register migration run, snapshot, and audit stores without storing migration-control data in domain records | Adds internal migration storage names | Schema alignment required; no business entity changes |
| `src/database/schema.js` | Add migration-control tables and bump Dexie schema version | IndexedDB schema upgrade | Upgrade must preserve existing rows and be tested against populated v1 databases; keep schema migration separate from user-data migration |
| `src/database/index.js` | Declare new stores and transactions | Enables durable snapshots, ledger, and audit | Open/upgrade transaction failures must not block access to already-existing data without clear recovery |
| `src/database/metadata.js` and `src/database/boot.js` | Persist/initialize compatible migration readiness metadata without resetting per-run state | Boot knows schema vs user-data migration state | Current metadata initialization writes default migration status on boot; implementation must not overwrite a completed/failed run status with `pending` |
| `src/migrations/registry.js` and/or `src/migrations/version-1.js` | Keep schema registry meaning intact and connect schema registration to any required schema increment | Schema registration only | Do not register user-data import as a reversible schema change; schema `down` remains non-destructive/not a data rollback |
| `src/validators/migration.js` | Extend from current schema/readiness checks to validate run metadata/transitions or delegate to new migration validators | Migration gate becomes enforceable | Avoid two competing state vocabularies; preserve approved names exactly |
| `src/repositories/index.js` | Export new migration APIs only if the established module boundary requires it | Public internal import surface | Avoid exporting migration internals as general domain repositories |
| `src/repositories/settingsLegacyAdapter.js`, `codeListLegacyAdapter.js`, `expenseLegacyAdapter.js`, `incomeLegacyAdapter.js`, `momentLegacyAdapter.js`, `activityLegacyAdapter.js`, `memoryLegacyAdapter.js`, `attachmentLegacyAdapter.js` | Reuse/read-protect source parsing, expose parse/presence diagnostics and stable raw provenance needed by the source adapters | Legacy compatibility reads become observable and non-silent | Preserve legacy accessors; do not make adapters write, normalize destructively, or remove source keys |
| `src/services/guestMergeService.js` | Stop the pre-existing Firestore write + localStorage deletion path from running before local migration; replace only with an explicit Dexie-local guest-to-account migration invocation when user-approved | Prevents loss and cloud writes; changes login transition behavior | High risk because AuthProvider currently expects this to finish before setting account state. Gate rollout behind tested migration completion; preserve guest rows if migration fails |
| `src/context/AuthContext.jsx` | Invoke/recover the coordinator at the correct authenticated transition and do not set the app to a misleading ready state before the migration gate | Authenticated startup/order change | Must handle auth listener repeats, React Strict Mode, cancellation, offline Firebase read failure, and avoid duplicate runs |
| `src/context/GuestContext.jsx` and `src/store/useAppStore.js` | Resolve guest principal, startup migration readiness, and preference ownership without deleting legacy values | Guest mode becomes Dexie-backed after migration | High risk: existing APIs use guest booleans/null user IDs while repositories require owner IDs; define stable guest owner identity before implementation |
| `src/main.jsx` | Await database schema initialization before starting migration/app data reads; remove parallel race between `initializeDatabase()` and React boot where needed | Startup sequencing | Avoid blank/hung startup; provide recoverable failure state; ensure Strict Mode does not start duplicate migrations |
| `src/services/eventService.js`, `expenseService.js`, `incomeService.js` | Keep as read-only compatibility sources during transition; route reads only through the migration source adapter where needed, and prevent normal local-first startup from rewriting legacy sources | Limits legacy dual-write/read paths | Broad regression surface; do not remove Firebase services or existing legacy data in this deliverable |
| `src/database/boot.js` / app startup integration | Surface `MigrationCoordinator` status to the app gate and ensure open/ready ordering | Migration state affects first-use availability | DB boot success is not equivalent to data migration completion |

### Ownership decision required before implementation

Current guest repositories require a non-null `userId`, while guest localStorage records have no stable owner ID. Before implementing guest migration, approve and use one stable local guest principal stored in migration/Dexie metadata (not by mutating legacy sources), and define the explicit guest-to-account adoption consent flow. Never bind guest rows to the active Firebase `uid` automatically. This is a prerequisite, not a repository redesign.

## 11. Testing plan

### Unit tests

- State transition graph, illegal transition rejection, terminal state behavior, and transition audit entries.
- Each source adapter: missing key vs empty array, malformed JSON, unexpected top-level shape, storage access exception, stable raw fingerprint, no writes/removals.
- Every domain transform using real legacy fixture shapes and canonical mapper/validator behavior.
- Deterministic identity and repeated-run fingerprint stability.
- Per-domain duplicate rules, exact duplicate decisions, conflict distinctions, false-positive prevention.
- Row, business, relationship, orphan, and migration count validation.
- Snapshot serialization/checksum, quota refusal, versioning, expiry eligibility, and corruption detection.
- Audit redaction, required metadata, append-only event order, history queries.

### Integration tests

- In-memory/fake IndexedDB: shared Dexie transaction across all repository writes; injected error rolls back all domain rows and run ledger consistently.
- Existing populated database: schema upgrade preserves v1 data and migration metadata; boot never resets a completed migration.
- Repository writer contract: write through existing repositories only; verify canonical repository reads return imported rows and no table bypass occurs.
- Commit source fingerprint change between preview and commit invalidates approval and prevents write.
- Concurrent auth/listener calls yield exactly one active run per principal; lock recovers only after verifying prior run/snapshot.

### Migration tests

- Firebase source with eventGroups, direct expenses, nested expenses, incomes, both IDs (Firestore/application), child relations, greeting card, and partial/old schema shapes.
- Guest source with all three keys; direct/nested expense overlap; settings keys; absent vs empty values; custom code-list metadata.
- Mixed-source preview and controlled merge with no source writes.
- Large-but-supported fixtures and exact reconciliation: source rows = imported + duplicate + conflict + rejected + skipped.
- Idempotent rerun after success and retry after failure using a new run ID.

### Rollback tests

- Pre-write failure confirms target unchanged; no unnecessary restore is reported.
- Failure during an atomic multi-table write leaves old rows intact.
- Simulated uncertain/post-commit validation failure invokes snapshot restore and verifies checksums.
- Explicit rollback of completed import with unchanged target succeeds; with newer Dexie edits blocks instead of deleting edits.
- Snapshot corruption, IndexedDB quota exhaustion, partial rollback interruption, and recovery on next startup.

### Guest migration tests

- Guest principal is stable across reloads and does not equal any Firebase uid.
- Legacy keys remain byte-for-byte unchanged on success, failure, cancellation, and rollback.
- Guest data imports only into guest-owned Dexie rows unless user explicitly approves account-local adoption.
- Guest/account overlap exact matches deduplicate with both lineage origins; content conflicts are surfaced and preserve both or block.
- Login while migration is pending does not invoke the old cloud merge/deletion path.

### Firebase migration tests

- Firebase Emulator or deterministic Firestore adapter fixtures verify authenticated UID scoping and read-only behavior.
- Read errors/permission denied/network unavailable are not interpreted as zero records or success.
- Firebase record changes after preview invalidate the approval and require a new preview.
- No `setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, batch write, or Firebase Storage upload is called by migration.
- Partial rollout keeps legacy Firebase reads available for recovery; no source document is changed.

### Performance and failure simulation

- Benchmark realistic small/median/large user datasets across all domains; report read, snapshot, transform, validation, commit and rollback duration separately.
- Verify bounded memory, transaction duration, preview responsiveness, and IndexedDB quota preflight. Set a documented maximum import size; above it, fail safely before canonical writes rather than silently chunking into partial commits.
- Inject failure after every state transition, every dataset stage, snapshot verification, each repository write, transaction completion, post-write validation, audit append, rollback restore, and notification.
- Every injected case asserts state, source immutability, target integrity, audit evidence, lock status, and retry eligibility.

## 12. Definition of Done

Deliverable 5 implementation is complete only when all of the following are demonstrated:

- The migration framework, registry, coordinator, approved state machine, durable snapshots, rollback manager, audit ledger, and validation gates exist and are integrated.
- All eight domains migrate through the finalized canonical repository write boundary into Dexie.
- Guest and Firebase sources both migrate using authenticated/guest ownership rules; Firebase access is read-only.
- Settings and code-list key presence/version are preserved correctly; defaults are not misreported as imported data.
- All listed duplicate/overlap scenarios have deterministic decisions, with ambiguous matches represented as conflicts instead of silent data loss.
- Every row is accounted for as imported, already present, duplicate, conflict, rejected, rolled back, or skipped by explicit source selection.
- Migration is idempotent across restarts and repeated attempts; deterministic IDs and fingerprints prevent duplicate writes.
- Snapshot is durable, checksummed, verified before writes, retained under policy, and rollback restores the exact pre-run target when safe.
- Failure injection proves migration can fail at every phase without modifying legacy Firebase/localStorage or exposing partial canonical data as complete.
- Repository reads after migration show valid canonical rows and intact relationships; existing repository validation/build/regression tests pass.
- Legacy guest-to-Firebase merge/deletion cannot run ahead of migration or violate source-read-only policy.
- No Sync, Backup UI, Cloud Storage, Firebase writes, or legacy source cleanup is introduced.

## Implementation readiness risks

1. **Guest identity must be finalized:** Existing repositories require `userId`; guest rows do not have a stable local owner. This is the main pre-implementation blocker.
2. **Current auth transition is destructive to migration sources:** `guestMergeService` writes to Firestore and then removes localStorage keys; it must be gated/replaced first.
3. **Existing mappers default missing/invalid values:** Migration must validate before mapper normalization and make missing-ID generation deterministic.
4. **Nested expense overlap:** Firebase and guest expense sources may contain both master and activity-embedded representations; false deduplication can lose money records.
5. **Snapshot capacity:** Browser quota may not support a full pre-import snapshot for large users. Preflight and fail-before-write behavior are mandatory.
6. **Atomic transaction duration:** A single all-domain commit may exceed practical IndexedDB limits for very large datasets; staging and size limits must be tested before rollout.
7. **Attachment payload semantics:** Current records expose metadata/references, not guaranteed local file bytes. The migration must not claim binary attachments were copied or remotely available.
8. **Audit data minimization:** Audit records need original identities and decisions but should not duplicate sensitive financial/memory contents unnecessarily.
9. **Schema boot metadata:** Existing boot writes default migration metadata. It must be made non-destructive to run status before introducing durable migration state.

---

**Stop point:** This document specifies Deliverable 5 only. No code was generated, no files other than this specification were modified, and no migration, sync, backup/restore, or cloud write was implemented.
