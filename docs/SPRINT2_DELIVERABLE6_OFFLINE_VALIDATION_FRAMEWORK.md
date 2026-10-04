# Sprint 2 — Deliverable 6: Offline CRUD Validation Framework

**Status:** Implementation specification only. No code was generated and no tests or migration were run for this document.  
**Objective:** Establish a repeatable, evidence-producing way to prove that LifeHub's normal data operations work offline with Dexie as the authoritative local store.  
**Boundaries:** Do not implement Sync, cloud backup, cloud integrations, repository redesign, or UI redesign. This deliverable validates the approved architecture; it does not by itself wire repositories into every existing UI path.

## Executive assessment

### Offline CRUD Readiness Assessment

**Current verdict: NOT READY for offline-first CRUD acceptance.**

The Dexie foundation and repository modules exist, and they provide a substantial starting point for local persistence. However, the inspected application UI stores and services still route most normal business operations through Firebase or localStorage rather than these repositories. The repository layer's existence is not proof that normal app use is offline-safe.

| Area | Repository capability | Current UI/runtime path | Readiness |
|---|---|---|---|
| Moments | Dexie CRUD methods exist in `momentRepository` | `useEventStore` loads guest events from localStorage or account events from Firestore; create/update/delete call Firestore for accounts and localStorage for guests | Not ready; canonical event data is still event-shaped in UI and is not read from Dexie |
| Activities | Dexie create/update/delete/bulk methods exist | Embedded in an event object; UI edits activities by updating the parent event through `eventService` | Not ready; no wired independent activity persistence; requires atomic parent/child write behavior in the UI integration |
| Memories | Dexie methods exist | Embedded in parent event; `EventWorkspaceShell` updates event arrays through the event store | Not ready; no wired Dexie reads/writes |
| Attachments | Dexie metadata methods exist | Metadata is embedded in parent event and updated via event store; existing model does not guarantee local file bytes | Not ready; metadata and file-content durability must be specified separately |
| Expenses | Dexie read/upsert/bulk/delete methods exist | Authenticated operations use Firestore; guest operations use localStorage; nested activity expenses are reconciled in service code | Not ready; financial source of truth is not the repository |
| Income | Dexie read/upsert/bulk/delete methods exist | Authenticated operations use Firestore; guest operations use localStorage | Not ready |
| Settings | Dexie settings repository exists | `useAppStore` loads and writes `lifehub_preferences` and `lifehub_theme_choice` | Not ready; Dexie is not authoritative for UI settings |
| Code Lists | Dexie repository exists | `useAppStore` loads, migrates, and writes `lifehub_admin_values` and its version key; pages consume Zustand values | Not ready; localStorage remains authoritative in normal use |
| Boot/auth | Dexie boot initializes database concurrently with rendering | Firebase `onAuthStateChanged` establishes route access; authenticated callback awaits guest-to-Firebase merge; guest mode relies on localStorage | Not ready for dependable offline startup; database readiness is not an app readiness gate |
| PWA shell | Vite emits a service worker that precaches shell/entry chunks and provides navigation fallback | Service worker is registered after window load in production; Firebase requests are not intercepted for offline domain CRUD | Shell support exists; does not prove app data CRUD or offline authentication |
| Connectivity indication | `ConnectivityBanner` listens to `navigator.onLine` | Banner says cloud-sync-dependent changes are unavailable | Partial; browser online status is advisory and not a test of reachability or local-store health |

**Key distinctions:**

- There is no sync requirement here. Repository persistence must complete locally before a UI action reports success.
- Guest localStorage compatibility is legacy input/compatibility, not an acceptable authoritative store after offline CRUD acceptance.
- Firebase authentication may remain required to establish an authenticated principal; an already-established session must not need a live Firebase round trip to perform ordinary local CRUD. Product policy for cold-start offline authenticated users must be explicit and tested.
- Current startup allows React to render before `initializeDatabase()` resolves. That can race first reads/writes against database open and can make a protected route appear ready when Dexie is not.
- The current service-worker cache is shell asset caching. It does not cache Firestore data nor guarantee offline Firebase authentication.
- Browser/site-data clearing can delete IndexedDB; no local framework can promise survival of a deliberate full site-data erase without a separate export/backup facility, which is out of scope.

## 1. Current State Review

### Existing CRUD capability vs actual application wiring

Repositories expose CRUD-like methods but the audited stores still import the existing Firebase/guest service functions. The offline test suite must therefore have two separate result columns:

1. **Repository capability:** Does an operation persist/read from Dexie with network disabled?
2. **Product path:** Does the actual routed UI invoke that operation and render the persisted result without Firebase/localStorage as the business record store?

Passing column 1 alone does not satisfy Deliverable 6.

### Paths still dependent on Firebase

- `eventService.js`: authenticated event-group reads/writes/deletes use Firestore.
- `expenseService.js`: authenticated master expense collection reads/writes/deletes use Firestore and reads nested event-group expense data.
- `incomeService.js`: authenticated income reads/writes/deletes use Firestore.
- `AuthContext.jsx` uses the Firebase auth observer; on a signed-in user it currently calls `mergeGuestDataIntoAccount`.
- `guestMergeService.js` writes guest data to Firestore and removes guest storage keys. This behavior conflicts with the finalized read-only legacy source policy if allowed to run before/while local migration. Offline CRUD validation must keep migration disabled and assert that this flow is not triggered by routine CRUD. Any future activation gate remains a prerequisite for account onboarding, not part of this test framework.
- Account avatars/profile data can load remote images; these are not required for local data CRUD but should not block offline shell use.

### Paths still dependent on localStorage

- Guest event groups, expenses, incomes: `lifehub_guest_eventGroups`, `lifehub_guest_expenses`, `lifehub_guest_incomes` via the current services.
- Preferences/theme: `lifehub_preferences`, `lifehub_theme_choice` in `useAppStore` and startup theme initialization.
- Code lists/schema version: `lifehub_admin_values`, `lifehub_admin_values_schema_version` in `useAppStore` and code-list UI.
- Guest session marker: `lifehub_guest_mode` in guest/auth contexts.
- Dev fixtures and sample data use localStorage for isolated scenarios; these are test-only and must be excluded from production correctness claims.
- Settings export/import and clear-local-data flows in `Settings.jsx` interact with localStorage. The existing clear-local-data operation is destructive to legacy data and must not be used as an offline persistence test except in the explicit site-data-clearing scenario.

### Paths that are not yet offline-safe

- UI stores do not use the Dexie repositories for the eight canonical domains.
- Account CRUD optimistically updates Zustand, then calls Firestore; on failure it reverts. This is the inverse of local-first persistence and fails the offline success condition.
- Guest writes go to localStorage instead of Dexie.
- Event child records are embedded, so UI activity/memory/attachment operations do not independently persist to their approved repositories.
- Database initialization is fire-and-forget in `main.jsx`; routing is not gated on successful Dexie open or validated integrity.
- Auth route readiness is tied to Firebase callback and may remain unresolved or behave differently on cold offline launch.
- Existing code-list/settings UI setters are synchronous localStorage writes, while Dexie repository methods are asynchronous; UI integration needs an explicit persistence/error contract.
- Tests currently found cover selected event-status and code-list utility behavior, not actual Dexie repository persistence, offline startup, or PWA lifecycle.

## 2. Offline Operation Matrix

Legend: **Repo** means the Dexie repository exists; **UI** means the current user-facing CRUD path is wired to it. Status is assessed from inspected code, not inferred from the approved architecture statement.

| Domain | Create | Read | Update | Delete / restore | Missing requirements and validation |
|---|---|---|---|---|---|
| Moments | Repo: yes. UI: Firebase for account, localStorage for guest | Repo: Dexie query. UI: Firestore/localStorage | Repo: Dexie update. UI: Firestore/localStorage | Repo: delete/archive/restore. UI: Firestore/localStorage; event delete is physical | Wire UI to local repo; local-first optimistic policy only after Dexie success; preserve status, recurrence, greeting-card and dashboard visibility behavior; test restore/archive and child relationship policy |
| Activities | Repo: yes. UI: embedded on moment and saved by parent service | Repo: Dexie query. UI: parent event fetch | Repo: Dexie update. UI: parent Firestore/localStorage update | Repo: delete. UI: remove from embedded parent | Validate moment foreign key and owner; maintain completion/cancellation/status derivation; test child/expense references and atomic updates |
| Memories | Repo: yes. UI: embedded event arrays | Repo: Dexie query. UI: parent event read | Repo: Dexie update. UI: parent event update | Repo: delete. UI: embedded filter/update | Validate moment relation, meaningful content and timestamps; preserve order/display; test parent deletion behavior |
| Attachments | Repo: metadata create. UI: embedded metadata in event | Repo: query by moment. UI: event record | Repo: update. UI: event update | Repo: delete metadata. UI: event array filter | Separate metadata persistence from blob/file availability; validate URL/reference, size, MIME and parent; offline success refers to metadata only unless local binary storage is separately approved |
| Expenses | Repo: upsert/bulk. UI: Firestore account or localStorage guest; nested records through events | Repo: Dexie. UI: service merges master+nested remote/guest | Repo: upsert. UI: Firestore/localStorage | Repo: delete. UI: Firestore/localStorage/nested removal | Wire all paths; define one canonical expense row per logical expense; preserve moment/activity links and prevent duplicate totals; amount/date/category validation |
| Income | Repo: upsert/bulk. UI: Firestore account or localStorage guest | Repo: Dexie. UI: Firestore/localStorage | Repo: upsert. UI: Firestore/localStorage | Repo: delete. UI: Firestore/localStorage | Wire all paths; validate owner/date/type/amount; prove summaries use repository-backed store |
| Settings | Repo: set/update/reset. UI: Zustand + localStorage | Repo: Dexie. UI: `useAppStore` localStorage initializer | Repo: update. UI: localStorage setter | Repo: reset. UI: localStorage reset | Wire boot + settings UI; preserve theme/default/notification behavior; valid-value rejection must surface; verify read-after-write and reset semantics |
| Code Lists | Repo: list/upsert/delete/reset. UI: Zustand + localStorage | Repo: Dexie. UI: Zustand initialized from localStorage | Repo: Dexie upsert. UI: `setAdminValues` writes whole list to localStorage | Repo: delete/reset. UI: array rewrite in localStorage | Wire page selectors, dashboards, greeting and visibility helpers; maintain custom metadata, active values and in-use protection; ensure reset is atomic and preserves referenced entries |

### Matrix-wide acceptance rule

A row is **offline-ready** only when both repository and routed UI tests pass in offline mode, the mutation is acknowledged only after Dexie success, a full reload retrieves the same canonical record, relationships validate, and no Firebase/localStorage business-data write is observed. Readiness must be reported separately for guest principal and authenticated principal.

## 3. Offline Validation Framework Design

### Shared principles

- Test the approved repository APIs without changing their contracts.
- Test UI wiring independently from repository tests.
- Use controllable fake network conditions and real IndexedDB behavior where supported; do not treat a mocked repository as proof of Safari/PWA durability.
- Never let a test silently fall back to Firebase or localStorage. Instrument forbidden access and fail the test if normal CRUD invokes it.
- Report environment, browser/OS/device, app build, schema version, cache-control state, migration state, data seed, start/end time, and per-check evidence.
- Test framework must be passive by default. It may create uniquely namespaced disposable test records only in an explicitly selected test database/principal; never run it automatically against production user data.

### `OfflineValidator`

**Responsibilities:** Run named offline test profiles and apply go/no-go acceptance thresholds.

**Conceptual interface:**
- `run(profile, environment)` — execute selected repository/UI/integrity/PWA checks and return a structured report.
- `validateCRUD(domain, principal, operations)` — exercise create/read/update/delete and operation-specific workflows.
- `validateStartup(mode)` — measure app/database/auth readiness under online/offline/cache conditions.
- `summarize(results)` — produce pass/fail/blocked with evidence, severity, and failed acceptance IDs.

**Rules:** Browser offline flag/network blocking is not sufficient for real-airplane-mode certification. Distinguish simulated offline, network-layer blocked, device airplane mode, and captive/no-internet connectivity.

### `OfflineIntegrityChecker`

**Responsibilities:** Check database open/read/write readiness, per-domain row shape/owner identity, deterministic primary-key uniqueness, referential integrity, orphan rows, supported schema version, IndexedDB storage access/quota diagnostics, and post-operation read-after-write state.

**Checks:** Moment-child, expense-activity/moment relationships; per-principal isolation; settings/code-list uniqueness by logical compound key; invalid serialized values; stale staging or migration run states; no test data leaked into non-test principals. The checker is read-only unless given a disposable test database.

### `RepositoryOfflineTester`

**Responsibilities:** Invoke existing repository APIs using a test principal and deterministic fixture factory; disable/block network access during each test; verify results by reopening the database and reading through repositories after refresh/relaunch boundaries.

**Coverage:** CRUD APIs and edge contracts per the operation matrix; archive/restore for moments; completion/cancel transitions for activities; reset/list metadata behavior; invalid input; empty data; duplicate IDs; cross-principal isolation; database unavailable/quota exceptions.

### `FailureSimulator`

**Responsibilities:** Inject deterministic failures into a test environment only—database open/transaction error, quota exhaustion, malformed rows, validation rejection, interrupted migration run, storage denied, blocked/failed network, stale service worker, and duplicate/conflicting fixture records.

**Safety:** Must require an explicit test environment token/database; refuse to run against the default production Dexie instance. Each failure scenario states whether it can mutate data, expected rollback behavior, and cleanup verification. Migration is disabled in the standard offline CRUD suite; migration-interruption testing is isolated and must not commit user data.

## 4. Airplane Mode Validation Strategy

### Instrumentation and procedure

For every scenario, collect browser console errors, unhandled rejections, failed network requests, Firebase SDK calls, IndexedDB transactions, localStorage writes to business keys, state-store errors, and visible success/error feedback. Use separate test principals for guest and authenticated local data. Seed online once only when required; then turn off connectivity and run the scenario without reseeding.

### Scenarios

| Scenario | Procedure | Acceptance evidence | Failure criteria |
|---|---|---|---|
| A — fresh launch, no internet | Install/visit once online so the PWA shell is cached; close all tabs; enable airplane mode; cold-launch app/PWA; do not use an already-mounted page | Shell loads; Dexie opens; the expected already-provisioned principal is available under the product's offline-auth policy; protected screens render within threshold; no network request is required for local CRUD | Blank shell, infinite auth/loading gate, lost route/chunk, database-open race, or any Firebase read required to view local rows |
| B — create records, offline | In airplane mode create a moment, activity, memory, attachment metadata, expense, income; update settings and a code-list entry | Each save returns success only after local persistence; refresh/read-after-write shows same IDs/values; audit reports no cloud/business localStorage write | Optimistic UI claims success before persistence, network error blocks the operation, or record vanishes on re-read |
| C — update records, offline | Edit each previously created entity, complete/cancel activity, edit moment status/notes/greeting metadata, update financial values/settings/list metadata | Updated content survives route changes and full refresh; event status and dashboard/greeting behavior remain unchanged | Update falls back to Firestore/localStorage, state is only in Zustand, or validation silently coerces/rejects without feedback |
| D — delete and restore, offline | Delete records according to each domain's supported behavior; archive and restore a moment; delete child records and verify related expense/reference behavior | Delete result is deterministic; no dangling relationships; restore returns the intended moment state and preserves permitted children | Delete requires network, child removal leaves broken references, or restore resurrects stale/duplicate rows |
| E — close/reopen app | Force-close tab/browser or PWA while offline; relaunch after 30 seconds and after device restart | All committed Dexie rows, settings and lists are present; app reaches usable state | Any committed row disappears, DB upgrade loses data, or startup waits for network |
| F — browser refresh | Refresh while offline on dashboard and nested routes (including direct URL route) | Service worker serves shell/navigation fallback; route chunk available; Dexie data rehydrates correctly | Navigation returns network error, missing lazy chunk, reload loops, or in-memory-only state lost |
| G — migration framework disabled | Verify the migration coordinator is not invoked; make/refresh normal CRUD offline | CRUD operates only on canonical local repositories; no migration source scan or import occurs; no source mutation | Migration preview/import or old guest-to-Firebase merge runs as side effect of startup/login/CRUD |

### Network evidence rule

`navigator.onLine === false` is a useful trigger for simulation, not proof that requests cannot reach a network. Run browser request blocking and physical airplane-mode testing, and inspect outgoing requests independently. Firebase Analytics must never block startup; normal CRUD must issue zero Firebase/remote business-data calls.

## 5. Failure Simulation Framework

| Injected condition | Expected behavior | Recovery behavior | Audit/report evidence |
|---|---|---|---|
| Dexie unavailable/open rejected | App does not claim offline-ready or silently switch to legacy storage; show retryable local database failure state | Retry open; if still failing preserve any recoverable browser context and provide support guidance; no fake success | DB readiness, error name/code, operation blocked, no fallback write |
| Metadata corruption/schema mismatch | Integrity checker reports precise metadata/schema issue; no automatic destructive reset | Apply only an approved forward schema repair; if unknown/corrupt stop and retain database | Before/after metadata evidence; migration/schema version; whether user data remained unchanged |
| Repository validation failure | Mutation is rejected before persistence; UI displays a safe actionable error and keeps prior row intact | Correct input and retry; invalid record must not partially write | Domain/rule ID, operation, record test identity, storage unchanged assertion |
| Migration interrupted | In standard CRUD tests, migration is disabled and never runs. In isolated framework testing, interruption follows migration state/snapshot rules from Deliverable 5 | Resume/recovery only through the migration framework; ordinary repository CRUD remains isolated | Migration run state, snapshot integrity, no Firebase/localStorage mutation; explicitly separate test report |
| Attachment metadata corruption | Invalid reference/name/size fails integrity gate; do not claim content availability | User can repair/remove metadata under normal repository operation; actual file recovery is out of scope | Metadata fields/rule, relation status, no remote file operation |
| Invalid settings values | Repository validation blocks unsupported key/theme/value; UI state must not diverge from stored value | Keep last known persisted preference; re-render or show validation message | Exact safe rule code, persisted-before/after values compared without exposing secrets |
| Duplicate records | Detect same primary ID and duplicate logical identities according to approved identity rules; do not silently double-count financial records | Keep canonical existing row or require explicit remediation; no automatic broad fuzzy merge in this deliverable | Duplicate IDs, domain, candidate IDs/test tokens, selected outcome, expense totals before/after |
| Storage quota / transaction abort | Atomic operation fails; UI reports save failure; no partial multi-table mutation | Retry only after space is available; integrity check verifies previous state | Error class, estimated/available quota if API permits, transaction rollback/readback result |
| Firebase offline/timeout | Already-persisted local CRUD/read path unaffected; login/cloud-only actions can be unavailable with clear messaging | Existing authenticated local principal remains usable per approved policy; sign-in may be retried online | Firebase request count; no business operation rollback due remote failure |
| Service-worker update interruption | Existing installed shell remains usable; an incomplete candidate worker must not erase active cache before activation | Retry update online; validate old/new bundle compatibility after activation | Worker states/build IDs/cache inventory; no IDB mutation |

**Audit payload privacy:** Do not record full notes, memory bodies, attachment bytes, or full financial descriptions. Report test IDs/rule codes, counts and checksums; enable detailed payload capture only with synthetic fixtures and explicit test mode.

## 6. Performance Testing Plan

### Workloads

Seed datasets through the approved repositories using deterministic test identities. Exercise 100, 1,000, and 10,000 moments, with representative child ratios (activities, memories, attachment metadata) and financial volume. Include empty, median, and high-volume user profiles. Run on desktop Chromium and real target iOS Safari/PWA devices; do not extrapolate desktop timing to phones.

### Measurements

- Cold offline startup: navigation start to shell rendered, Dexie open, principal/session ready, and first local record shown.
- Warm launch/reopen and route transition readiness.
- CRUD p50/p95: single-row create/update/delete and parent-plus-child multi-row operations.
- Query/search p50/p95: by owner, date range, category/type, parent relation; identify query plans that fetch all rows then filter in JS.
- Dashboard computation (visibility, next-occurrence, greetings, summaries), event status derivation, expense aggregation, memory/attachment counts.
- IndexedDB transaction time, read/write counts, serialized payload size, estimated quota/headroom, main-thread long tasks and memory growth.
- Integrity-check duration and recovery/refresh duration.

### Proposed acceptance thresholds

These are release gates to verify and tune on a named device baseline; not claims of existing performance:

| Operation | Target |
|---|---:|
| Cold offline shell + Dexie-ready state (warm installed app) | p95 ≤ 3.0 s on reference iPhone; ≤ 2.0 s on reference desktop |
| First visible local dashboard data after Dexie ready, at 10,000 moments | p95 ≤ 2.0 s |
| Single-record CRUD acknowledgement after durable Dexie commit | p95 ≤ 250 ms; no UI thread task > 100 ms due to serialization |
| Common indexed repository query at 10,000 moments | p95 ≤ 200 ms |
| Search/filter across a 10,000-moment in-memory result | p95 ≤ 500 ms; indexed/query-first alternatives required if exceeded |
| Expense summary over 10,000 financial rows | p95 ≤ 500 ms |
| Integrity audit of 10,000 moments and representative related rows | p95 ≤ 5 s; run off the critical first-paint path or show progress |
| Data-write test failure rate under supported quota | 0 partial commits; 0 silent failures |

Measure five cold runs and 20 warm runs per target device/build; report median and p95. Thresholds must be revisited only with recorded baseline evidence, not loosened to mask an unexplained regression. Fail if a valid operation routinely exceeds target or has unbounded memory/transaction growth.

## 7. Safari / PWA Validation Strategy

### IndexedDB and storage persistence

- Verify IndexedDB open, transaction commit/abort, compound indexes and database version upgrade on current iOS Safari and installed Home Screen PWA; test the oldest supported iOS/Safari version chosen by product support policy.
- Validate close/reopen, refresh, PWA process termination, device restart, low-space warning, and repeated writes. Confirm all records by reading from Dexie after process restart, not from Zustand memory.
- Record `navigator.storage.estimate()` when available; treat missing/unsupported `navigator.storage.persist()` as a normal platform condition. Do not promise Safari persistent-storage pinning without verified browser support and explicit result.
- Test private browsing separately as a likely restricted/ephemeral mode; do not certify durable offline CRUD in private mode unless actual repeated device tests prove persistence. Show a blocking/limited-mode status if IndexedDB is unavailable or ephemeral.
- Low storage: approach quota using synthetic payloads; verify transaction failure leaves prior data intact, UI communicates failure, and app does not delete old user data to make room.
- Safari may evict origin data under OS storage pressure or inactivity; exercise prolonged dormant interval if the test farm permits it. A successful one-hour persistence test does not guarantee indefinite browser retention.

### iPhone Safari and Add to Home Screen

- Install through Safari's Add to Home Screen flow on a physical iPhone; verify standalone display, scope, icon, status-bar/theme behavior, launch URL and service-worker controller.
- First install requires online shell acquisition. Then turn on airplane mode and test cold launch, deep-link refresh, navigation, lazy-loaded screens, Dexie reads/writes, force quit and relaunch.
- Test foreground/background transitions, memory pressure termination, screen lock/unlock, low-power mode, orientation/viewport changes, and network changes while a write is in progress.
- App may be killed at any time on iOS. Every acknowledged operation must already be committed in Dexie; queued/in-flight operations must either commit atomically or report failure on next launch—never be assumed committed because a toast appeared.

### Refresh, application update and cache clearing

- Test browser refresh on a nested route while offline. Current worker has a navigation fallback to cached `index.html`, but successful route rendering also requires the exact JS chunks to remain cached.
- Test first install, waiting-worker update, accepted update/reload, interrupted update, old tab still open during deployment, and offline launch after successful update. Versioned caches are removed on worker activation; ensure the new worker has fully precached its entry graph before it claims clients.
- Confirm updating JS/CSS/service-worker caches does not change, clear, or recreate the Dexie database. Run a Dexie schema upgrade against a populated database and verify exact row counts/content/relationships.
- Test cache clearing separately from website-data clearing. Clearing service-worker/cache should require online shell reacquisition but must not clear IndexedDB. Clearing all Safari website data may erase IndexedDB and must be treated as destructive; the app must not claim recovery without a separately approved backup/export capability.
- Validate generated service worker in production output (`dist/sw.js`), because it is generated by the Vite plugin and is not present as `public/sw.js` in source.

### Acceptance criteria

1. Installed shell relaunches offline after an initial successful install and all cached route chunks needed by tested journeys are available.
2. Dexie CRUD and verified read-after-write survives refresh, PWA force-close/relaunch, and iPhone restart for committed operations.
3. App update and Dexie schema upgrade preserve all pre-existing rows and relationships; caches are not treated as data storage.
4. Quota/IDB failures are surfaced without partial rows or destructive cleanup.
5. When browser storage has been deliberately erased or is unavailable, LifeHub clearly reports that local data is unavailable; it does not fabricate empty successful results or silently switch authority to localStorage/Firebase.
6. Safari-specific tests record device model, iOS version, Safari/PWA mode, installed build, storage condition and worker version.

### Failure criteria

- IndexedDB open/commit failure is swallowed while UI reports success.
- App requires Firebase/Internet for an already-established user's normal local CRUD or to display existing Dexie records.
- App remains indefinitely in an auth/database loading state on cold offline launch under the supported session policy.
- PWA update produces a missing chunk or reload loop; offline navigation works only from an already-mounted page.
- App update/schema upgrade loses, duplicates, reassigns, or disconnects any persisted rows.
- Site-data/cache clearing is described as recoverable when there is no approved local recovery source.

## 8. Required Files

All are proposed additions for the later implementation task; no files are created by this specification.

| Proposed file | Responsibility |
|---|---|
| `src/offline/OfflineValidator.js` | Orchestrate validation profiles, apply acceptance rules and produce pass/fail/blocked outcomes |
| `src/offline/OfflineIntegrityChecker.js` | Read-only Dexie schema, ownership, row and relationship audit; orphan/duplicate detection |
| `src/offline/RepositoryOfflineTester.js` | Run deterministic CRUD/read-after-reopen checks through existing repository contracts |
| `src/offline/FailureSimulator.js` | Test-only network/storage/database/quota/validation fault injection; refuse production DB |
| `src/offline/DataIntegrityAuditor.js` | Domain-level cross-table integrity and count/checksum audit; distinguish warning vs blocking violation |
| `src/offline/PWAValidationHelper.js` | Inspect service worker registration/controller/cache/build IDs and expose test hooks for reload/update lifecycle |
| `src/offline/OfflineAuditLogger.js` | Structured, privacy-minimized test evidence for environment, operations, timings, errors and outcome |
| `src/offline/OfflineReadinessReport.js` | Generate machine-readable and human-readable report with per-domain readiness, evidence, blocked dependencies and failed criteria |
| `src/offline/offlineConstants.js` | Stable check IDs, domain IDs, result levels and threshold definitions |
| `src/offline/offlineTestFixtures.js` | Synthetic domain fixtures and deterministic IDs/timestamps; never production-derived personal data |
| `src/offline/offlineTestDatabase.js` | Create/close/delete uniquely named disposable Dexie database for tests; guard against default DB access |
| `src/offline/offlineNetworkHarness.js` | Abstract simulated offline, request-blocked, and physical-device test evidence; no production request interception |
| `src/offline/offlineStorageProbe.js` | Probe IndexedDB availability, transaction commit, estimate/persistence API support and quota failure diagnostics |
| `src/offline/offlinePerformance.js` | Timing collection and percentile summaries for startup, queries, CRUD and integrity scans |

### Proposed tests

- `src/offline/OfflineValidator.test.mjs`
- `src/offline/OfflineIntegrityChecker.test.mjs`
- `src/offline/RepositoryOfflineTester.test.mjs`
- `src/offline/FailureSimulator.test.mjs`
- `src/offline/DataIntegrityAuditor.test.mjs`
- `src/offline/PWAValidationHelper.test.mjs`
- `src/offline/OfflineAuditLogger.test.mjs`
- `src/offline/OfflineReadinessReport.test.mjs`
- `src/offline/offlineRepositoryIntegration.test.mjs`
- `src/offline/offlineStartupIntegration.test.mjs`
- `src/offline/offlinePerformance.test.mjs`
- Physical-device test records under `docs/testing/offline/` (manual Safari/PWA evidence, not automated unit fixtures).

## 9. Required Modifications

These are anticipated integration/validation changes, not repository redesign. Each requires targeted tests. The first three are blockers before product-path DoD can pass.

| Existing file | Reason | Impact | Risk | Validation requirements |
|---|---|---|---|---|
| `src/main.jsx` | Gate protected app rendering on Dexie open/health; avoid racing boot and first repository access; preserve offline shell | Startup sequencing and explicit DB unavailable state | High | Cold online/offline startup; failed DB open; no indefinite loading; Strict Mode double initialization; launch/reload tests |
| `src/context/AuthContext.jsx` | Define behavior for Firebase auth callback unavailable offline; keep an already established local principal usable; prevent legacy guest merge from running automatically in offline CRUD path | Changes authenticated startup and migration/guest transition boundary | High | Offline cold/warm launch; callback delayed/errored; existing account principal remains scoped; prove zero Firebase writes and no key deletion |
| `src/services/guestMergeService.js` | Current function writes guest rows to Firestore and removes legacy keys; must not run as side effect of normal local CRUD or violate D5 source policy | Guest-to-account lifecycle only | Critical | Assert function not called by normal startup/CRUD; source localStorage unchanged; no Firestore batch writes; explicit migration boundary tests |
| `src/store/useEventStore.js` | Route moment/activity UI data operations through approved local repositories while preserving event status and current UI shape/behavior | Broad events/dashboard/workspace behavior | Critical | Full event/activity create/edit/delete/archive/restore, child relations, status derivation, old event/service regression tests, offline network assertion |
| `src/store/useExpenseStore.js` | Use local repository as operation/read authority instead of Firebase/localStorage service | Financial state and optimistic UX | Critical | Expense CRUD, nested/master dedupe and totals, no cloud/localStorage writes, failure rollback and reload tests |
| `src/store/useIncomeStore.js` | Use local repository authority | Income state and summaries | High | Income CRUD, totals, no cloud/localStorage writes, reload and failure tests |
| `src/store/useAppStore.js` | Stop localStorage from being authoritative for preferences/code lists; hydrate from repositories after DB-ready; add async persistence/error behavior without UI redesign | Store initialization and setters become persistence-aware | Critical | Settings/code-list CRUD/reset, initial hydration order, update/reload, invalid value feedback, storage unavailable tests |
| `src/layouts/DashboardLayout.jsx` | Source quick-create options and values from Dexie-backed store; communicate persistence result rather than Firebase reachability | Shared quick-create workflows | High | Offline quick-create moment/activity/expense journeys; success only after commit |
| `src/pages/Events.jsx`, `src/features/events/components/EventWorkspaceShell.jsx` | Keep event/activity/memory/attachment UI actions mapped to local repositories and preserve embedded-view behavior as a presentation adapter only | Main record management UI | Critical | Scenario coverage from section 4; statuses, greeting and child counts unchanged; no nested stale copies |
| `src/pages/Expenses.jsx`, `src/pages/Income.jsx`, `src/pages/Financials.jsx`, `src/pages/Insights.jsx`, `src/features/dashboard/components/DashboardOverview.jsx` | Ensure aggregations, activity expenses, recurrences and visibility use canonical repository-backed state | Reporting/dashboard correctness | High | Offline summaries match exact fixture totals/counts/visibility; regression against existing expected behavior |
| `src/pages/Settings.jsx`, `src/pages/CodeLists.jsx` | Route preference/list edit/reset through repositories; keep backup/local-data tools from being mistaken for canonical CRUD | Settings and code-list writes; existing maintenance UI | High | Edit/reset/reload tests; referenced-list protections; no authoritative business localStorage dependencies |
| `src/components/common/ConnectivityBanner.jsx` | Align status message with local-first behavior: offline should not imply CRUD unavailable; display storage readiness separately from connectivity | User-facing connectivity semantics, not redesign | Medium | Airplane-mode CRUD visible as available; remote-only action messaging remains truthful; `navigator.onLine` treated as advisory |
| `src/database/boot.js`, `src/database/metadata.js` | Separate DB-ready/integrity status from unused migration status; preserve stored status rather than writing defaults over it; report schema/IDB failure | Boot metadata semantics | High | Populated DB startup, corrupted metadata, version upgrade and persistent run-state tests |
| `src/database/schema.js`, `src/database/tables.js` | Only if offline-test/report/audit metadata needs additional stores or indexes; D5 migration stores already exist | Potential Dexie schema version increment | High | Upgrade populated v2 DB; no table/data loss; indexes match actual owner/relationship queries; rollback/version tests |
| `vite.config.js`, `firebase.json`, `public/manifest.webmanifest` | Test/fix PWA precache headers/scope/update behavior only where tests demonstrate a defect; do not redesign PWA or introduce cloud dependencies | Offline app shell/install/update | High | Production artifact tests, cache graph completeness, headers, direct-route navigation, worker update and fallback tests |
| `src/App.jsx`, `src/routes/ProtectedRoute.jsx` | Show a recoverable startup state when DB health fails and prevent auth readiness alone from implying data readiness | Routing gate | High | Auth ready but Dexie unavailable; Dexie ready while offline auth provider is unreachable; direct nested route test |
| `package.json` | Add test scripts/dependencies only if necessary for IndexedDB/Safari/browser automation | Test tooling only | Low–medium | Reproducible CI, supported Node/browser versions, no production dependency bloat |

**No repository contract or data model change is proposed.** If a validation test reveals a repository API cannot support a required existing UI action, record it as a blocker and obtain separate approval rather than silently redesigning it in Deliverable 6.

## 10. Test Plan

| Category | Goal | Required coverage | Success criteria | Failure criteria |
|---|---|---|---|---|
| Unit tests | Verify validators, state/report rules, adapters and deterministic checks in isolation | Valid/invalid entity fixtures; state transitions; IDs; duplicate/orphan outcomes; threshold classification | Each rule has positive and negative assertions; deterministic results; no network/browser global required unless injected | Flaky outputs, hidden coercion, unhandled failures, or rule not tied to stable report ID |
| Integration tests | Prove repositories interoperate with real disposable IndexedDB and app adapters | All 8 domains; multi-table relationships; settings/list hydration; store integration; DB reopen | Writes and reads survive closing/reopening test database; no Firebase/localStorage authority paths invoked | Mock-only success, leaked default DB, partial commits, incorrect scope |
| Offline CRUD tests | Prove each domain's create/read/update/delete or supported restore/reset operations offline | Full matrix and operation-specific scenarios in section 2/4 | Zero remote business calls; committed data survives query/reopen; UI reports durable outcome | Any mutation/read requires Firebase or localStorage business record; changes exist only in state memory |
| Airplane Mode tests | Validate physical no-connectivity behavior | A–G scenarios, guest and established authenticated principal; cold launch and direct routes | All local workflows pass with radio disabled and trace confirms no required network request | Simulated-only result presented as physical certification; app hangs or CRUD fails |
| Repository persistence tests | Isolate each repository's actual persistence behavior | CRUD, ownership, validation, duplicate identity, date/type query and failure cases | Exact expected rows after reopen; rejected operation leaves original state intact | In-memory-only state, wrong owner leakage, invalid data saved |
| Database integrity tests | Verify Dexie schema, indexes, references and owner isolation | Schema version upgrade from populated DB; orphan scans; duplicate key/compound identity; metadata state | Zero unexplained orphan/duplicate rows; counts/checksums stable through upgrade | Data loss, relationships broken, status reset, invalid state goes unreported |
| Failure simulation tests | Prove safe behavior under faults | DB unavailable, quota, transaction abort, corrupted metadata/row, invalid settings, duplicate, interrupted migration isolated | Error surfaced; no partial writes; last committed state remains readable; audit evidence is privacy-safe | Silent fallback/success, partial writes, overwritten records or destructive cleanup |
| PWA tests | Prove installed shell and navigation independently from data tests | First install, offline reload, direct nested route, lazy chunks, waiting worker, update, cache clearing | Offline shell is available after install; update preserves IndexedDB and route chunks; no reload loop | Only current in-memory tab works; missing assets; update clears user rows |
| Safari tests | Prove browser-specific IndexedDB/PWA lifecycle | Physical current and oldest supported iOS Safari, A2HS, standalone, private mode, low storage, restart, OS termination | Repeatable evidence per device/version; committed Dexie data persists under supported storage conditions; unsupported modes clearly marked | Extrapolating desktop/Chromium results to iOS; Safari write failure not surfaced |
| Performance tests | Establish responsiveness at 100/1k/10k moments and child/financial ratios | Startup, queries/search, dashboard, expense aggregation, writes, integrity audit; p50/p95 | Meets section 6 thresholds on named baselines; zero partial writes | Unbounded query/transaction; thresholds missed; no device baseline recorded |
| Data recovery tests | Ensure recognized failures do not fabricate success and normal reopen preserves committed data | Close/reopen, restart, update, failed transaction, migration disabled, IDB unavailable, site data deliberately erased | Committed state persists through process/app lifecycle; deliberate erase is reported honestly; no unsupported restore promise | Claimed recovery without source, silent empty dataset, unrelated data removed |
| Regression tests | Preserve present application behavior while changing persistence authority | Event status, recurrence, dashboard visibility, greetings/templates, code-list metadata, sort preferences, financial calculations, guest mode | Existing tests pass plus behavior fixtures are unchanged with Dexie-backed state | Changed status/visibility/greetings, incorrect totals, lost custom metadata, changed navigation |

### Mandatory per-domain offline scenarios

- **Moments:** create/read/edit/delete, archive/restore, recurrence/greeting/status preservation, dashboard visibility.
- **Activities:** create/read/edit, complete, cancel, delete; parent relationship, completion timestamp/status semantics.
- **Memories:** create/read/update/delete; parent relation and content preservation.
- **Attachments:** create/read/update/delete metadata; distinguish metadata persistence from file-byte availability.
- **Expenses:** create/read/update/delete; activity/moment links; master-vs-nested duplicate check; aggregate amount consistency.
- **Income:** create/read/update/delete; totals and date/type filters.
- **Settings:** hydrate/update/read/reset; theme applies after refresh; invalid value leaves persisted state intact.
- **Code Lists:** hydrate/add/edit/remove/disable/activate/reset; referenced entries stay protected; greeting/dashboard metadata survives.

## 11. Risk Register

| ID | Risk | Severity | Mitigation / gate |
|---|---|---|---|
| R1 | UI stores still route canonical CRUD to Firebase/localStorage | Critical | Do not claim Deliverable 6 DoD until all routed user flows pass repository-offline tests |
| R2 | Firebase auth readiness blocks cold offline startup | Critical | Define supported principal/session policy; test cached established session and cold unauthenticated offline state; separate auth readiness from DB readiness |
| R3 | Legacy guest merge writes Firebase and deletes guest keys | Critical | Keep disabled from normal offline flows; test zero writes/key deletion; explicit migration-only lifecycle must honor Deliverable 5 policy |
| R4 | Fire-and-forget database boot races app rendering | High | Gate application data access on Dexie open/integrity readiness; test failure and Strict Mode |
| R5 | Child records embedded in UI while repositories are normalized | High | Use a presentation adapter over repositories and preserve atomic parent/child semantics; no model redesign in this deliverable |
| R6 | Current validators/mappers normalize some bad values rather than reject them | High | Test raw and canonical boundary behavior; validation framework must distinguish invalid input from defaulted values |
| R7 | Dexie schema stores indexes that may not enforce all logical uniqueness or foreign keys | High | Integrity checker performs explicit cross-table checks; no assumption that IndexedDB enforces foreign keys |
| R8 | Safari/iOS storage eviction or private mode limits | High | Physical-device matrix, quota/availability probes and clear warnings; do not promise persistence in unsupported/ephemeral modes |
| R9 | PWA caches shell only and can have update/chunk gaps | High | Test generated production worker and every lazy route after cold offline launch and update |
| R10 | 10,000-row full scans/dashboard calculations exceed mobile limits | Medium–high | Record p95 on physical iPhone; use existing indexes/queries; integrity audit must not block first paint |
| R11 | `navigator.onLine` gives false positives/negatives | Medium | Combine browser, request-blocking and physical airplane-mode evidence; never use this flag as proof of remote reachability |
| R12 | Deliberate Safari website-data clearing erases IndexedDB | High / expected platform boundary | Document as destructive; tell user data is unavailable; recovery requires separately approved backup/export mechanism, which is out of scope |
| R13 | Existing clear-local-data/backup code remains localStorage-oriented | High | Prevent tests/users from treating it as canonical data recovery; revise only with explicit product behavior approval |
| R14 | Test harness mutates real user database or logs sensitive values | Critical | Disposable DB guard, synthetic fixtures, strict privacy minimization and production refusal |
| R15 | “Existing application behavior unchanged” conflicts with offline-first persistence switch | High | Define regression fixtures for domain behavior separately from persistence-source behavior; acceptance review verifies intentional source change only |

## 12. Deliverable 6 Definition of Done

Deliverable 6 is complete only when all of the following have repeatable automated or documented physical-device evidence:

- The offline validation tools in section 8 and the test-only failure harness exist with production-database safety guards.
- Every repository CRUD operation for all eight domains completes in airplane mode through the approved repositories.
- Routed product flows for moments, activities, memories, attachment metadata, expenses, income, settings and code lists use Dexie as the active source of truth.
- A save is acknowledged only after its IndexedDB transaction commits; transaction failure produces an honest error and leaves prior committed state intact.
- Data survives browser refresh, app close/reopen, PWA relaunch and device restart on supported browser/storage configurations.
- Moments, activities, memories, attachment metadata, expenses and incomes retain valid same-principal relationships; integrity checks report zero unexplained orphans/duplicate logical records.
- Settings and code lists rehydrate from Dexie and no longer rely on localStorage for authoritative values.
- Normal CRUD has zero Firebase business-data reads/writes and zero localStorage business-record writes. Firebase/localStorage remain only for explicitly allowed auth/shell/legacy compatibility boundaries, not the source of record.
- Migration remains disabled during offline CRUD tests; the existing guest cloud-merge path cannot fire as an ordinary CRUD side effect.
- Validation, integrity, failure simulation, PWA, Safari, performance and regression suites pass against documented browser/device versions and build IDs.
- Storage unavailable, quota exhausted, malformed values, duplicate rows, offline auth, schema upgrade and cache update failures are surfaced without silent fallback or partial success.
- Build and all pre-existing tests pass; domain behavior for event status, dashboard visibility, greetings, financial summaries and custom code-list metadata remains unchanged.
- No Sync engine, Backup UI, Cloud Backup, Google Drive, OneDrive, iCloud or other cloud integration has been added.

### Release gate

Do not mark the product offline-ready based only on the validator framework passing against repositories. Deliverable 6's final sign-off requires the current UI paths to be wired to those repositories and every acceptance category above to pass. Until then the readiness report must say **NOT READY** or **PARTIAL**, identify blockers, and avoid asserting that all eight CRUD domains work offline.

---

**Stop point:** This document defines Deliverable 6 only. No code was generated; no repository, UI, migration, sync, backup or cloud behavior was changed.
