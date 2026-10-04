# Sprint 2 — Deliverable 6A: Repository Adoption and Runtime Cutover

**Status:** Implementation specification only. No code was generated and no repository/UI behavior was changed.  
**Objective:** Change the normal runtime persistence path from UI → Zustand store → Firebase/localStorage service to UI → Zustand store → approved repository → Dexie, while preserving visible features and behaviors.  
**Fixed decisions:** Dexie is the active local source of truth; existing repositories and models are approved; Firebase remains compatibility/authentication and read-only legacy migration source; localStorage is not authoritative for business records. No Sync, Backup UI, Cloud integrations, repository redesign, or UI redesign.

## 1. Current Runtime Dependency Map

### Current app data paths

| Domain | Current runtime path | Repository path already available | Cutover result |
|---|---|---|---|
| Moments and Activities | Events/Workspace/DashboardLayout → `useEventStore` → `eventService` → Firestore for account or `lifehub_guest_eventGroups` localStorage for guest. Activities are embedded under each event. | `momentRepository` and `activityRepository` | Store replaces service persistence with repository calls. Store may continue producing the event-shaped presentation object consumed by existing UI, but repository rows are canonical. |
| Memories and Attachments | Event workspace → `useEventStore.updateEventItem` → whole embedded event write to Firestore/localStorage. | `memoryRepository` and `attachmentRepository` | Store-facing event projection reads child repositories and updates individual child rows. Attachment persistence means metadata/reference only, not file-byte availability. |
| Expenses | Expense UI → `useExpenseStore` → `expenseService` → Firestore and event-group nested expenses for account; localStorage direct+nested lists for guest. | `expenseRepository` | Store reads/writes Dexie; embedded expense remains a legacy import/presentation concern and must not be independently counted twice. |
| Income | Income/Financials → `useIncomeStore` → `incomeService` → Firestore or guest localStorage. | `incomeRepository` | Store reads/writes Dexie. |
| Settings | Settings/UI → `useAppStore` setters → localStorage keys. Initial values are read synchronously from localStorage at module load. | `settingsRepository` | Hydrate after Dexie readiness; make preferences changes repository-backed and asynchronous; localStorage key read only through D5 migration/compatibility code. |
| Code Lists | Settings/CodeLists selectors → `useAppStore` → localStorage `lifehub_admin_values` and schema version. | `codeListRepository` | Store actions write repository list/entry APIs; pages continue consuming the same `adminValues` shape. Defaults remain application defaults and are bootstrapped into Dexie through the approved repository when no rows exist. |
| Session/owner | AuthContext Firebase auth observer; GuestContext and app store use guest mode boolean/localStorage marker | D5 `getOrCreateGuestPrincipalId` exists | Resolve principal once after DB open: Firebase `uid` for account, stable Dexie guest principal for guest. A null UID must never be passed as an actual repository owner. |

### Runtime consumers identified

- `useEventStore` is directly used by Events, EventWorkspaceShell, DashboardLayout quick-create, DashboardOverview and related screens. It returns event-shaped objects, including `activities`, `memories` and `attachments`; that public UI shape must be preserved during this cutover.
- `useExpenseStore` and `useIncomeStore` power pages, Financials totals, Settings reference protection, Insights and event-linked expense workflows.
- `useAppStore` is both session/UI state and currently a persistence implementation for settings/code lists. Session, toast, route and transient UI state remain in Zustand; persistent preferences/lists move to their repositories.
- `Settings.jsx` also has separate backup/import/clear-local-data maintenance actions that directly reference old localStorage keys. Those actions are not canonical CRUD and must be audited so they do not claim to back up/restore/clear Dexie data after the cutover. Backup UI redesign is out of scope; old localStorage-only functions must be clearly isolated/deprecated or blocked from operating on canonical records.
- `Financials.jsx` computes totals from the expense/income stores. Preserve that presentation/aggregation behavior; only change how stores supply their arrays.
- `DashboardOverview.jsx` computes greeting/visibility from event records, preferences and code-list metadata. Preserve its helpers, event shape, recurrence behavior and visibility/greeting results.

### Repository export surface gap

`src/repositories/index.js` currently exports Settings, Code List, Expense and Income APIs, but omits Moment, Activity, Memory and Attachment repositories. The cutover implementation must add the approved event-domain exports (or maintain deliberate direct imports consistently) so all store integrations have one discoverable repository boundary. This is export wiring only, not a repository redesign.

## 2. Repository Adoption Plan

### Adoption rules

1. Stores become the only normal app data access boundary for screens. Stores call repositories directly; a service must not sit between a store and Dexie for normal CRUD.
2. Repositories remain the only canonical persistence boundary. Do not add Dexie operations to components, pages or stores.
3. A mutation is reflected as successful UI state only after the repository operation resolves successfully. If local optimistic rendering is retained, restore the exact previous store projection on failure and do not show success before the local transaction commits.
4. Each store resolves one owner principal per operation: `user.uid` for authenticated mode and the D5-generated stable guest principal for guest mode. Never use null, `'anonymous'`, or a guest boolean as a repository `userId`.
5. Keep UI model adapters at the store boundary. The event store can compose `Moment + Activities + Memories + Attachments` into the existing event-shaped records. This projection is for rendering only; writes are directed to appropriate repositories.
6. Maintain one canonical owner for expenses. Nested `activity.expenses` found in legacy sources are imported once into `expenseRepository` and associated by `momentId`/`activityId`; financial totals must not add the same row from both a nested activity projection and the expense store.
7. Preserve behavior rather than incidental transport details: event status, cancellation/completion semantics, recurrence, greeting card content, dashboard visibility, code-list custom metadata, sort preferences, currency, quick-create, referenced-list protection, toast/error handling and existing navigation.
8. Normal CRUD must not call Firebase services, read or write business localStorage keys, or silently fall back to them when Dexie fails. Auth identity and explicitly isolated migration/legacy compatibility readers are not normal CRUD.

### Principal and hydration contract

- Database readiness precedes persistent-store hydration and protected data routes. `initializeDatabase()` cannot remain fire-and-forget relative to repository reads.
- Session initialization resolves `principal = { id, type }`: authenticated principal ID is Firebase `uid`; guest principal ID comes from `getOrCreateGuestPrincipalId(db)` in migration metadata. Use the same ID consistently for every repository and domain.
- Hydrate settings, code lists, moments, activities, memories, attachments, expenses and incomes from Dexie after both the database and principal are available.
- On owner change, clear the previous owner's arrays before hydration, cancel/ignore late responses from the prior owner, and only publish rows whose `userId` matches the active principal.
- Existing `loadEvents(uid, isGuest)` and financial-store signatures have many call sites. Keep a compatibility signature for the cutover if it reduces UI changes, but derive the actual repository principal internally from a single resolver. Deprecate caller-provided `isGuest`/uid combinations only after all call sites are updated and tested.
- New authenticated users with no local rows start with empty canonical data plus default preferences/lists. Do not fetch Firestore automatically to fill missing Dexie data during ordinary reads.

### Cutover sequencing

1. **Readiness and principal gate:** make DB open/health explicit and resolve the guest/account owner.
2. **Settings and Code Lists:** migrate legacy keys through D5 only with source-presence checks; seed defaults through repository bootstrap; change store hydration/setters.
3. **Expenses and Income:** switch store load and all CRUD to repositories; preserve summary and event-reference consumers.
4. **Moments and children:** project repository tables into event-shaped store values; route all event/activity/memory/attachment actions to the respective repository; coordinate parent/child deletes and updates without redesigning domain tables.
5. **Pages and helper consumers:** ensure all visible routes use the updated stores and that no component calls legacy services for ordinary operations.
6. **Compatibility isolation:** make Firebase/localStorage service functions read-only migration/diagnostic facilities and remove automatic guest cloud merge/deletion from routine auth transition.
7. **Regression and removal of fallback:** instrument and test zero legacy business reads/writes in normal CRUD; only then deprecate dead normal-path service exports.

### Existing repository API mapping

| Store action | Repository calls |
|---|---|
| Load event view | `momentRepository.getAll(principal)` plus child repository `getAll`/`getByMoment`; join by canonical `momentId`; map event status using existing `getEventStatus` without changing status rules |
| Add moment with initial children | Create moment then child rows through each corresponding repository; preserve user-visible all-or-nothing behavior with a Dexie transaction coordinated by the store/repository boundary only if existing APIs support the operation. If they cannot participate in a shared transaction, report as a cutover blocker and obtain scoped integration approval; do not fake atomicity |
| Edit moment/event workspace | `momentRepository.update`; child changes call activity/memory/attachment CRUD separately; refresh/recompose current projection |
| Delete moment | `momentRepository.delete` plus the existing approved child lifecycle behavior. Determine from current UX whether child records are deleted or blocked; apply consistently within a transaction and test orphan integrity |
| Activity create/complete/cancel/delete | `activityRepository.create/update/delete`; preserve completedAt/cancelled fields and derived moment status behavior |
| Memory/attachment add/edit/remove | Corresponding repositories; attachment operations concern metadata/reference only |
| Expense create/update/delete | `expenseRepository.upsert/delete`; preserve date/event/activity filters and financial totals |
| Income create/update/delete | `incomeRepository.upsert/delete` |
| Preferences | `settingsRepository.getPreferences`, `updatePreferences`, `setOne/updateOne`, `resetToDefaults` as appropriate; store may merge defaults for rendering, but it must persist only approved keys/values |
| Code list load/edit/reset | `codeListRepository.getAll/getList/getMeta/upsertEntry/deleteList/resetToDefaults`; retain full metadata shape and protect values referenced by existing moments/expenses/incomes |

## 3. Store Refactoring Plan

### `useAppStore.js`

- Separate volatile application/session state (`user`, guest mode, loading, toast) from persistent user preferences and Code Lists.
- Remove module-evaluation-time localStorage reads/writes for persistent settings and admin values.
- Add/define an asynchronous hydration lifecycle keyed by owner principal; only mark persistent state ready after Dexie reads and any default seeding finish.
- Preserve existing state fields (`preferences`, `adminValues`) and synchronous selectors where possible so UI consumers remain stable. Actions `setPreferences`, `setAdminValues`, `resetPreferences`, `resetAdminValues`, and `resetAllSettings` must resolve persistence outcomes rather than silently mutating localStorage.
- Merge existing default preferences/code lists in memory for display; do not persist unapproved defaults as user edits. Preserve versioned code-list semantics and metadata via existing code-list utilities and repository APIs.
- Update settings state after repository success; on failure retain prior values, set error/toast state and return/reject consistently.
- Keep only `lifehub_guest_mode` session compatibility (if still needed during transition) outside business data. It is not the owner ID or data source.

### `useEventStore.js`

- Remove `eventService` persistence imports from normal execution: `getEventsForUser`, guest list functions and Firebase create/update/delete functions must not be called by store CRUD.
- Add explicit repository imports for moments, activities, memories and attachments. Compose a presentation model with the current `events[]` structure and `getEventStatus` derived behavior.
- Load by active principal; preserve pending-load deduplication and stale-load protection, but key loads by canonical principal rather than guest flag plus arbitrary UID.
- `addEvent` writes a canonical moment record. Existing UI currently passes new event with activities empty; maintain behavior while supporting any existing initial children without dropping them.
- `updateEventItem` currently receives a full event object and many callers alter only one embedded child array. The store must diff by child IDs and persist only added/changed/deleted child records in the corresponding repositories, plus moment scalar changes. An unchanged child must not be deleted/recreated just because the whole event object was passed.
- Preserve activity expense relation updates and prevent nested expense copies from becoming a second canonical financial record.
- `deleteEventItem` and child deletion must respect existing delete confirmations and restore/archive behavior. Define whether deleting a moment cascades or is blocked when children exist based on the present UX, and validate in one local transaction if supported.
- Keep sample data branch strictly test/dev-only; production data operations must not route to localStorage fixtures.

### `useExpenseStore.js` / `useIncomeStore.js`

- Remove Firebase and guest-localStorage service imports and route `load`, `add`, `update`, `delete` to their respective repositories.
- Preserve `loading`, `error`, loaded-owner caching, pending load de-duplication, owner-change clearing and current public action signatures for existing page compatibility.
- Do not synthesize a successful row only in Zustand. On local persistence error restore prior state and expose current error affordances.
- Use stable `principalId` for repository ownership; handle existing callers that pass `uid,isGuest` through the owner resolver.
- Preserve any `firestoreId` lineage fields in existing rows for migration/compatibility, but do not use them as a trigger for normal remote write/delete.
- Expenses must remain a single canonical list. `Events`/`Expenses` flows that attach an expense to an activity must update `expenseRepository` with canonical parent IDs rather than only embedding an object.

## 4. Service Layer Deprecation Strategy

### `eventService.js`, `expenseService.js`, `incomeService.js`

- **Phase 1 — freeze:** Keep existing exported functions intact for test fixtures/legacy migration compatibility; mark their role as legacy. Do not add new normal CRUD features there.
- **Phase 2 — disconnect normal runtime:** Remove imports/calls from `useEventStore`, `useExpenseStore`, `useIncomeStore` and all ordinary screen/store paths. Existing service tests remain as compatibility contract tests, not store persistence tests.
- **Phase 3 — read-only compatibility:** Keep only the raw source readers needed by D5 migration/diagnostics. No Firebase writes, localStorage writes, normal UI fallback, or source deletion. If normalizers are needed for legacy translation, they must not write or manufacture a durable result silently.
- **Phase 4 — deprecate/remove unused writer exports:** Only after reference search proves no normal callers remain and all compatibility imports are covered by migration tests. Removal is optional and separate; Firebase itself and account data are not removed.
- `guestMergeService.js` is not a domain repository and currently writes to Firebase then removes source localStorage keys. It must not run automatically as part of authenticated state observation after cutover. Keep it disabled/deprecated until an explicitly approved migration/adoption path replaces it.

### Migration compatibility is not a runtime fallback

- Run D5 import explicitly before cutover for legacy datasets under its approved source/consent rules. Deliverable 6A must not call migration automatically from repository reads or silently import on a failed Dexie query.
- A missing Dexie row is not permission to fetch from Firebase or localStorage. Report empty canonical state or a not-yet-migrated gate.
- Preserve original Firebase/localStorage sources read-only during rollout until migration verification and separate cleanup approval.

## 5. Firebase Compatibility Strategy

- Firebase remains used for account authentication and explicit legacy source reads by the migration framework, but not for ordinary create/read/update/delete of domain data.
- Firestore data already imported remains available as legacy source evidence; no writes or deletions occur during cutover or routine CRUD.
- Normal reads must not fetch Firestore when the Dexie result is empty, stale, or unavailable. Database failure must be reported honestly; do not fall back to remote data and mix source-of-truths.
- `AuthContext` may observe Firebase auth to identify an online or previously authenticated account. Once a principal is established in app state, local CRUD must not wait on a Firestore request. Cold offline auth policy must be made explicit: an existing Firebase Auth persisted user may be accepted if Firebase Auth resolves it offline; otherwise route to guest or a clearly limited state without assigning account data to guest.
- Remove the current `mergeGuestDataIntoAccount` automatic call from auth observer after migration/adoption policy is ready. It must not batch-write guest data to Firestore or remove legacy keys during startup.
- Firebase SDK/network calls allowed in normal usage: authentication lifecycle where required, explicit sign-in/sign-out, analytics only if non-blocking, and explicitly invoked migration source reads. All domain CRUD requests should be zero.

## 6. Guest Mode Compatibility Strategy

- Reuse the stable local guest principal in `migrationPrincipal.js`, persisted in Dexie metadata. Resolve it after database initialization and before loading repositories.
- Guest principal is distinct from all Firebase UIDs and survives refresh, app restart, PWA relaunch and authentication transitions.
- Guest records in Dexie are authoritative exactly like account records, scoped by guest principal. Guest mode does not use `lifehub_guest_eventGroups`, `lifehub_guest_expenses`, or `lifehub_guest_incomes` for ordinary reads/writes after cutover.
- Perform explicit D5 migration/preview to bring existing guest legacy rows into guest-principal Dexie. Preserve all localStorage sources read-only until import outcomes and counts are verified. Do not start migration implicitly in store `load*` methods.
- Signing in while guest data exists does not silently transfer/merge/delete it. Present/retain the already approved explicit migration/adoption flow; until approved, account principal sees only account-owned rows and guest principal retains guest rows.
- Signing out of an account does not relabel account rows to guest. Guest sessions use the stable guest owner only.
- Dev sample scenarios stay isolated from production repositories and must be disabled in production builds or remain explicitly namespaced/test-only.

## 7. File-by-File Modification Plan

| File | Required work | Behavior protected / validation |
|---|---|---|
| `src/store/useAppStore.js` | Replace localStorage-backed settings/code-list hydration and setters with async repository hydration/actions; keep session/toast state in Zustand | Default merging, theme application, notifications, sorting, code-list metadata and reset behavior; no business localStorage writes |
| `src/store/useEventStore.js` | Replace `eventService` paths with Moment/Activity/Memory/Attachment repository calls; preserve event projection and existing public store API during rollout | Status, optimistic rollback, activity child diffs, sample-mode isolation, relationship integrity and owner scoping |
| `src/store/useExpenseStore.js` | Replace `expenseService` with `expenseRepository`; remove guest localStorage branch | CRUD, nested-expense dedupe, financial totals, loaded-owner behavior and failure state |
| `src/store/useIncomeStore.js` | Replace `incomeService` with `incomeRepository`; remove guest localStorage branch | CRUD, reports/totals, owner switching and failure behavior |
| `src/repositories/index.js` | Export Moment, Activity, Memory and Attachment repository APIs consistently | Import graph and public internal boundary; no data behavior change |
| `src/services/eventService.js` | Freeze/deprecate normal writer API; retain read-only legacy parser/normalizer only where D5 needs it | Existing legacy/service tests remain; zero normal runtime imports |
| `src/services/expenseService.js` | Freeze/deprecate Firestore/localStorage writers; retain compatibility read/normalization only if migration requires | No expense mutation through this module; reconcile historical nested records once through migration only |
| `src/services/incomeService.js` | Freeze/deprecate Firestore/localStorage writers; retain read-only migration compatibility | No income CRUD through this module |
| `src/services/guestMergeService.js` | Remove from automatic auth startup; mark legacy cloud-write/delete path unavailable to ordinary app transitions | Auth change cannot write Firestore or delete guest source keys without explicit approved migration action |
| `src/context/AuthContext.jsx` | Establish identity/session only; resolve DB/principal readiness separately; stop auto-merge behavior | Guest/account separation, offline startup policy, no duplicate auth observer migration calls |
| `src/context/GuestContext.jsx` | Use resolved stable guest principal; preserve user-visible guest session transitions | Guest principal continuity without using business localStorage as data store |
| `src/database/boot.js` / `src/main.jsx` | Make database readiness an initialization gate for persistent hydration and protected data usage | Open failure/upgrade, cold offline launch, browser/PWA refresh, no boot race |
| `src/migrations/migrationPrincipal.js` | Reuse as guest principal provider; no redesign; ensure initialization can run with opened DB and stable result | Same principal across relaunches; no UID collision; migration not invoked implicitly |
| `src/layouts/DashboardLayout.jsx` | Keep quick-create UI, use updated stores; adapt any preloaded data/principal arguments only as needed | Quick create moment/activity/expense exactly as before; repository writes finish before success toast |
| `src/pages/Settings.jsx` | Retain existing settings screen; route save/reset through async store actions; audit localStorage-only export/import/clear controls as legacy-only and prevent claiming Dexie is included | Preferences, list reset, reference preservation, honest errors; no inadvertent canonical data deletion |
| `src/pages/CodeLists.jsx` | Keep presentation and edit gestures; await persistent `setAdminValues`/list actions and handle errors | Add/edit/rename/delete/disable/activate, in-use checks and event-type greeting/dashboard metadata |
| `src/pages/Financials.jsx` | No persistence logic redesign; retain selectors/aggregation from updated stores | Totals and recent record order match expected fixtures after refresh/offline |
| `src/pages/Events.jsx` | Keep existing UI actions but ensure calls use repository-backed stores; no direct service imports | Moment/activity CRUD, status behavior, confirmation/deletion and expense links |
| `src/features/events/components/EventWorkspaceShell.jsx` | Route greeting/activity/memory/attachment edits via updated store methods, retaining current detail UI | Child counts, content, paths, event status and offline mutations persist |
| `src/features/dashboard/components/DashboardOverview.jsx` | Ideally no data-write change; ensure it consumes Dexie-hydrated stores/settings/code lists only | `getDashboardVisibleEvents`, recurring moments, greeting card templates/output unchanged |
| `src/pages/Expenses.jsx`, `src/pages/Income.jsx`, `src/pages/Insights.jsx` | Audit all CRUD and aggregation consumers for nested event/service shortcuts; use updated store projections | Expense/activity relation and insight counts/totals remain correct |
| `src/components/common/ConnectivityBanner.jsx` | Correct offline message after local CRUD is active; distinguish network connectivity from local database readiness | Offline indicator does not imply local edits are disabled; DB failure has separate feedback |
| Tests: store/service/repository suites | Add migration-to-cutover fixture tests and no-legacy-call assertions | Exact source counts, relationships, no cloud/local writes, preserved behavior |

## 8. Risk Analysis

| Risk | Severity | Impact | Mitigation / gate |
|---|---|---|---|
| Legacy data has not been imported before normal stores stop reading it | Critical | Existing users may appear to lose events, finance records or preferences | Run approved D5 source selection/preview/import and verify per-domain reconciliation before per-principal cutover; never auto-fallback |
| Guest principal currently differs from the old null/boolean guest identity | Critical | Rows may be inaccessible or accidentally cross-owned | Use the stable D5 guest principal; test same identity through refresh and account transitions |
| Event UI submits a complete embedded object for a one-child change | Critical | Naive mapping can overwrite/delete sibling rows or lose child data | Implement identity-based diff in store; add fixture tests for unchanged siblings and nested expenses |
| Expense is represented both in expense table and in activity's embedded expenses | Critical | Doubled reports or accidental loss on event edit/delete | Normalize to one repository-owned Expense; store projection must not re-emit/aggregate duplicate nested source; verify sums exactly |
| Atomicity unavailable across existing repository methods | High | Partial moment+child mutations or parent deletion leaves orphans | Confirm Dexie transaction participation in approved methods; if blocked, obtain narrowly scoped integration approval; do not report success on partial commit |
| Zustand set action currently synchronous/localStorage but repository operations are async | High | UI may update before durable write or Settings forms may race | Specify awaitable store action outcomes; preserve previous state on errors and make page save feedback await success |
| Auth observer runs before Dexie boot and auto-merges guest records to Firestore | Critical | Data writes/deletions occur before cutover and principal resolved | Gate auth/store hydration on boot; remove the automatic guest merge path before enabling repositories |
| Account migration/remote-only legacy records not in local Dexie | High | Offline sign-in may present empty state | Explicit D5 import/reconciliation is a rollout prerequisite; no silent Firestore fallback in runtime |
| Current status/greeting/dashboard behavior derives from embedded event structures and code-list metadata | High | Presentation regressions despite persisted rows being correct | Preserve existing event projection shape; run event status/greeting/dashboard visibility snapshots before/after |
| Settings/code-list defaults get mistaken for imported user values | Medium–high | Custom settings/list values can be overwritten or defaults duplicated | Respect D5 key-presence handling; repository bootstrap defaults separate from imported legacy values |
| Multiple `load*` calls occur from many routes/components | Medium–high | Redundant reads, stale races or owner data flashes | Retain pending-load de-duplication keyed by principal; clear arrays on owner change and test stale response isolation |
| Test/sample data branches use localStorage | Medium | Tests can pass while production remains non-local-first | Build mode guards and separate sample-vs-canonical assertions; no sample-data branch in production readiness evidence |
| Settings backup/clear actions imply local data authority | High | Users may erase legacy keys thinking Dexie is included, or believe backup contains canonical data | Keep these utilities explicitly outside cutover; disable or accurately constrain old localStorage behavior pending separate approved backup scope |

## 9. Validation Plan

### Static/runtime dependency gates

- Search normal UI/store imports and call sites: `useEventStore`, `useExpenseStore`, `useIncomeStore`, `useAppStore`, and targeted pages must not invoke Firebase CRUD service functions or read/write business localStorage keys.
- Instrument `firebase/firestore` write methods and `Storage.setItem/removeItem` for business data during normal flows. Expected count: zero. Instrument Firebase reads for domain collections during ordinary CRUD; expected count: zero.
- Confirm every active store write reaches the corresponding repository; test spies should observe repository invocation and exact principal/domain IDs.
- Confirm all four event-domain repositories are reachable through the chosen export/import convention.

### Data and behavior gates

- Before/after cutover, run deterministic behavior fixtures for event status, completion/cancellation, recurrence, greeting template selection, dashboard visibility, code-list metadata, financial totals, sorting and referenced-list protection.
- Use D5 migration result counts and source fingerprints; check source = imported + already present + duplicate + conflict + rejected + explicitly skipped. Block a production user's cutover if unresolved conflicts/rejections could hide data.
- Verify event projection round-trips Moment and child rows without loss; verify child removal does not accidentally drop expenses unless the defined current UX requires it.
- Validate owner isolation between account A, account B and stable guest principal after load, create, update, sign-out and refresh.

### Automated tests

- Store unit tests with mocked repositories and forbidden service spies for every action and failure path.
- Dexie integration tests against disposable IndexedDB: create/read/update/delete, multi-table child operations, owner scoping and close/reopen persistence.
- Page integration tests for Settings, CodeLists, Events, Financials and DashboardOverview to ensure existing controls still work and values rehydrate from repositories.
- Failure tests: Dexie open failure, transaction abort, validation rejection, stale load, principal switch, duplicate child identity, unsupported legacy source. Verify no Firebase/localStorage fallback.
- Run existing event service/code-list utility suites as legacy compatibility/regression tests, not as proof of store adoption.

### Acceptance / failure criteria

**Pass:** all normal persistence paths call repositories; repositories persist in Dexie; each operation is visible after store reload and browser refresh; behavior fixtures match; zero normal Firebase domain calls and zero business localStorage reads/writes; no owner leaks, duplicate financial totals, partial parent-child changes, or data loss.

**Fail:** a normal store/page path calls `getEventsForUser`, `createEvent`, `getExpensesForUser`, `createExpense`, `getIncomesForUser`, or their guest localStorage counterparts; store success precedes persistence; legacy source is used as fallback; repository errors are swallowed; post-cutover rows or relationships differ from approved migration reconciliation; visible behavior changes unintentionally.

## 10. Definition of Done

Deliverable 6A is complete only when:

- `useAppStore`, `useEventStore`, `useExpenseStore`, and `useIncomeStore` use approved repositories for persistent domain data.
- The normal runtime path is UI → Store → Repository → Dexie for all supported domain CRUD.
- All eight repositories are used for the domains they own, including child repositories for activities, memories and attachment metadata.
- Firebase service modules are no longer imported by normal CRUD stores/pages; Firebase is retained for authentication and explicit read-only compatibility/migration only.
- localStorage is not authoritative for settings, code lists, moments, activities, memories, attachments, expenses or income. No normal CRUD uses guest keys as a fallback.
- Stable guest principal is used consistently and is distinct from account UIDs; account and guest data remain separate unless an explicitly approved migration/adoption action is invoked.
- D5 migration/legacy reconciliation is completed and verified before switching existing users from legacy source reads to Dexie-only runtime.
- Settings and CodeLists keep their current controls, defaults, custom metadata and reference-safety behavior.
- Financial and event screens preserve current totals, status, greetings, dashboard visibility, recurrence and child behavior.
- Every write is durable before success is exposed; failures leave canonical and rendered state consistent.
- No automatic guest-to-Firebase batch write or source-key deletion occurs during auth transitions or CRUD.
- Automated repository/store/page tests, dependency-boundary tests, existing regressions, offline validation and production build all pass.
- No Sync, Backup UI, cloud backup, new cloud integration, repository redesign or UI redesign is introduced.

**Cutover release rule:** Do not route a user's stores to Dexie-only reads until D5 migration has accounted for that user's legacy data. Once switched, do not fall back to Firestore/localStorage when a Dexie query returns empty or fails; surface the migration/DB readiness state instead.

---

**Stop point:** Deliverable 6A specification only. No code was generated or changed.
