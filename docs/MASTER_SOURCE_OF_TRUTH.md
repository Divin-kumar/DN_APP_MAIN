# DN — MASTER SOURCE OF TRUTH

Canonical reference for DN's current behavior and architecture on `OldVersion`.

Reviewed: 2026-10-22 (UTC). Source baseline: `a7f5c26d6e43a971b1461b101f8823129de12cf6`; remote `OldVersion` matched that SHA during review. This is a present-state reference, not a release history. Read [AGENTS.md](../AGENTS.md) before changes; [README.md](../README.md) indexes setup and documentation.

## 1. Evidence and scope

- **Verified by executable checks:** only specific checks/outcomes in section 15. A utility or source-text test does not establish a successful browser/Firebase journey.
- **Implementation-derived:** behavior traced through checked-out source. Unless explicitly identified as executed, descriptions below have this status.
- **Unverified:** browser/device behavior, deployed permissions, deployment state and recovery guarantees without executed evidence. Gaps appear in section 14.

Current source takes precedence over this reference. Update it alongside changes to behavior, architecture, routes, persistence, configuration or important constraints. Replace obsolete explanations. [The changelog](CHANGE_AUDIT_LOG.md) records the latest change first while preserving historical entry text; it does not override current behavior or maintenance policy.

## 2. Purpose and technology

DN organizes personal Moments (also labelled Events), activities, notes, memories, greeting cards and attachment metadata, alongside income/expense tracking and derived Insights. It supports Google accounts and browser-local guests. It is not a verified accounting, archival or notification service.

| Layer | Implementation |
|---|---|
| Package | `dn` 1.0.19, ES modules |
| UI | React/React DOM `^18.3.1`, JSX, Lucide React `^1.48.0`, Framer Motion `^13.4.6` |
| Routing | React Router DOM `^6.28.0`, BrowserRouter, lazy pages |
| State | Zustand `^5.0.0`, auth/guest contexts, component form/menu state |
| Backend client | Firebase `^12.19.0`: Google Auth, Firestore, optional production Analytics |
| Build/test | Vite `^5.4.10`, React plugin `^4.3.3`, Node `--test` |
| Presentation | `src/index.css` then `src/design-system.css`, root `data-theme` |
| Hosting/PWA | Firebase Hosting configuration, generated service worker, manifest |

There is no separate application REST/GraphQL server. Browsers call Firebase directly. Ranges above are [package declarations](../package.json), not a fresh vulnerability assessment.

## 3. Bootstrap, navigation and routes

[main.jsx](../src/main.jsx) migrates browser keys, applies theme and mounts StrictMode → BrowserRouter → App. [App.jsx](../src/App.jsx) supplies AuthProvider/GuestProvider, global toasts, Suspense and route error boundaries.

Except `/login`, routes use ProtectedRoute and DashboardLayout. The guard shows a skeleton until auth is ready, permits account/guest sessions, or redirects to login with the original location in navigation state. Login returns to that pathname (default `/dashboard`); it does not preserve query/hash in that return path.

| URL | Actual result |
|---|---|
| `/login` | Google popup or Continue as Guest; active sessions navigate onward |
| `/`, `/dashboard` | DashboardHome → DashboardOverview |
| `/events` | Moments list and creation flows; no grid mode or view toggle |
| `/activities` | Replace redirect to `/events` |
| `/events/:eventId`, `/events/:eventId/overview` | Moment Overview |
| `/events/:eventId/activities` | Moment activities |
| `/events/:eventId/memories` | Moment memories |
| `/events/:eventId/attachments` | Attachment metadata |
| `/events/:eventId/timeline` | Activity timeline with dates, descriptions and completion/cancellation state |
| `/events/:eventId/pdf` | Workspace mounts with Overview selected; no dedicated PDF screen |
| `/financials`, `/financials/transactions` | Same Transactions workspace |
| `/financials/income`, `/financials/expenses` | Replace redirect to `/financials/transactions` |
| `/insights` | Derived reports and report JSON export |
| `/settings` | Preferences, notifications, backup/reset, development samples |
| `/settings/code-lists` | Code Lists |
| `/settings/about` | Guide, build information and refresh |
| Unmatched URL | Replace redirect to `/` |

Desktop/sidebar and mobile navigation contains Dashboard, Events, Financials and Settings. Insights is reachable from Dashboard. Profile links to `/settings#profile`. Quick Create opens Moment, Activity or Transaction forms. Activity offers a Moment-type selector derived from loaded Moments, followed by the narrowed Moment selector. It includes existing/disabled historical types and custom Other labels, retains archived Moments with an Archived suffix, and clears a selected Moment when a changed type excludes it. Type filtering changes no stored type or activity fields; saving still requires a Moment and title. Theme saves locally. Logout exits guest mode or signs out of Firebase and returns to login. Shell content scroll positions are retained in memory for history navigation. Switching sections of the same Moment preserves the mounted workspace, drafts and scroll position (subject to shorter content clamping); another Moment or application page has a distinct transition key.

Financials accepts `create=income`, `create=expense` or `create=transaction`, plus optional `event`/`activity` presets; it opens the unified form then replaces the URL with `/financials/transactions`. Workspace `create=activity` opens its activity form and removes the query. Settings hashes `#profile`, `#preferences`, `#theme`, `#notifications`, `#backup` open the relevant section.

Sources: [layout](../src/layouts/DashboardLayout.jsx), [Moment route identity](../src/utils/momentWorkspaceRoutes.js), [Activity Moment picker](../src/utils/activityMomentPicker.js), [guard](../src/routes/ProtectedRoute.jsx), [login](../src/pages/LoginPage.jsx), [workspace](../src/features/events/components/EventWorkspaceShell.jsx).

## 4. State and execution paths

```text
page/component → Zustand action or transaction coordinator → service
  → Firestore (account) / localStorage (guest) / active development fixtures
```

| Module | Responsibility |
|---|---|
| `useAppStore` | Session/auth readiness, preferences, Code Lists hydration/queued saves, toast |
| `useEventStore` | Event aggregates with nested children, load/CRUD, status |
| `useIncomeStore`, `useExpenseStore` | Typed records, load ownership/pending requests, optimistic account CRUD |
| `useTransactionManager` | Unified edits, type conversion and expense mirrors |
| `useDashboardStore` | Declares dashboard arrays; no consumers found; routed Dashboard uses event store |
| Component state | Drafts, filters, selected records, dialogs/menus |

Stores choose active sample data first, then guest/account services. Zustand is in-memory, not a durable sync queue. Full replacement setters invalidate load ownership. Account CRUD generally uses optimistic state with targeted rollback; services normalize before persistence.

Financial load keys use `guest:<uid-or-anonymous>` / `user:<uid-or-anonymous>`. Scope changes clear old records; pending requests are reused and inactive completions ignored. Financials waits for both typed stores' `loadedFor` to match expected scope. `patchLoadedExpenses` preserves scope during nested-only edits. Load failures set errors and return empty results, so callers must check errors.

Event loads also clear stale account/guest records, require matching active/loaded scope keys and rejoin pending loads safely. Dashboard requests the current scope on session changes, hides stale-scope data and presents loading/error Retry states. Account Moment creation first resolves an unloaded scope, preserves a legacy collection destination and guards asynchronous completion against account switches. These source/mock-tested guards do not certify every concurrent cloud mutation.

Sources: [app store](../src/store/useAppStore.js), [events](../src/store/useEventStore.js), [income](../src/store/useIncomeStore.js), [expense](../src/store/useExpenseStore.js), [scope helper](../src/utils/financialLoadScope.js), [coordinator](../src/hooks/useTransactionManager.js).

## 5. Authentication, guest and sample lifecycle

Firebase uses GoogleAuthProvider and `signInWithPopup`. AuthProvider subscribes to auth changes, calls `beginAccountLoad`, hydrates account Code Lists, attempts guest-record merge, then activates the user. Revision checks prevent obsolete initialization from activating a superseded session. Code List/merge errors are logged and sign-in proceeds. Login popup failures are console-logged without a dedicated visible retry interface.

Guest entry sets `dn_guest_mode=true` and hydrates guest Code Lists. Auth restores this mode when there is no Firebase user. Guest exit clears both naming generations of the mode marker but keeps guest records. Logout is not account deletion and does not delete cloud records.

Guest merge reads events, merged guest expenses and incomes, writes one Firestore batch using fresh document IDs while preserving application IDs, then clears guest mode and the three guest record keys in both supported naming generations after commit. It neither checks destination IDs for duplicates nor chunks large imports. Other keys, including session backup, remain. Batch capacity and retries/duplicates are limitations; AuthProvider logs merge failure without a dedicated recovery screen.

Samples operate only with `import.meta.env.DEV` and no supplied UID. Settings rejects activation while signed in. `dn_dev_fixture_scenario` / `dn_dev_fixture_data` hold isolated fixtures; store mutations use separate sample branches. Sample event changes filter related fixture expenses, unlike ordinary event deletion. Clear active fixtures before real restore; Settings explicitly rejects restore while a sample is active.

In the local clear-sample browser journey, cached sample expenses remained visible until reload. Reload read the preserved original guest ledger correctly. Clear-sample feedback does not establish that every in-memory projection has refreshed; this development-only limitation does not run in the production build.

Sources: [auth context](../src/context/AuthContext.jsx), [guest context](../src/context/GuestContext.jsx), [auth facade](../src/services/firebase.js), [merge](../src/services/guestMergeService.js), [samples](../src/dev/sampleData.js).

## 6. Persistence, identifiers and synchronization

| Data | Account | Browser/guest |
|---|---|---|
| Moments/nested children | `users/{uid}/eventGroups` | `dn_guest_eventGroups` |
| Standalone expenses | `users/{uid}/expenses` | `dn_guest_expenses` |
| Income | `users/{uid}/incomes` | `dn_guest_incomes` |
| Code Lists | `users/{uid}/settings/codelists` | `dn_guest_admin_values` and schema-version key; `dn_admin_values` compatibility/hydration keys |
| Preferences/theme | Browser-local even signed in | `dn_preferences`, `dn_theme_choice` |
| Moment picker IDs | Browser-local, scoped | `dn_favorite_event_ids_{uid|guest|local}`, `dn_recent_event_ids_{uid|guest|local}` |
| Transaction filters | sessionStorage, scoped | `dn_transactions_filters_{uid|guest|local}` |
| Guest event copy | No remote backup | `dn_session_backup`, refreshed by guest event reads/writes |

Application `id` differs from provider `firestoreId`. Numeric legacy IDs and relationship IDs normalize to strings; account records missing a stored ID use the stable document ID, preserving identity across reloads/export. Financial dates accept strings, Firestore Timestamps and serialized timestamps; creation timestamps preserve their exact instant. Malformed stored records have not necessarily passed UI validation.

Account reads use `getDocs` and writes add/update/delete document calls. No `onSnapshot` subscriptions, explicit persistent Firestore/IndexedDB cache, app outbox or cross-device conflict engine exists in inspected source. Loaded stores cache per scope, so external changes are not a guaranteed live feed. UID paths are client conventions, not server authorization.

Account Moment reads use eventGroups, falling back non-destructively to the original events collection only when eventGroups is empty. Runtime firestoreCollection metadata routes edits/deletes/new Moments in all-legacy accounts back to that collection, and is excluded from portable backups. Optional legacy-read permission denial warns without failing a successful canonical read; other failures propagate. Mixed accounts with both collections use canonical eventGroups; this is not a cross-collection migration. Expense readers use the same Moment reader for embedded expenses and combine standalone records first, embedded activity expenses second, deduplicating by normalized string ID (first wins). Guest expense writes update only the standalone ledger rather than persisting the merged projection. Nested-only records remain supported. Ordinary account/guest Moment or activity deletion does not cascade into standalone income/expense ledgers; dangling financial links can remain.

Browser migration copies recognized old keys only to absent `dn_` keys and retains originals; existing DN values win. `clearDnLocalData` removes recognized app keys in both naming generations from localStorage, not Firestore, Firebase auth storage, service-worker caches or transaction sessionStorage. Session backup is a local copy, not an automatic recovery system.

Sources: [event service](../src/services/eventService.js), [income service](../src/services/incomeService.js), [expense service](../src/services/expenseService.js), [migration](../src/utils/storageMigration.js).

## 7. Dashboard, Moments, activities and greetings

### Dashboard

The routed DashboardHome renders DashboardOverview: greeting, today's Moment count, On This Day spotlight/greeting, upcoming Moments within 30 days and View Insights. It does not render Finance summary cards. Upcoming includes non-archived, non-cancelled Moments dated today through 30 calendar days ahead whose Moment Type permits Show on Dashboard. Completed future Moments remain eligible. Code Lists restores the Show on Dashboard switch and existing false flags take effect again. Missing/unknown type flags default visible. Other Moments use matching custom-type metadata when available, otherwise generic Other metadata. Spotlight/today's count use separate date logic.

Dashboard date helpers parse local calendar dates, legacy startDate/createdAt, Firestore Timestamps and legacy isRecurring flags. Recurrence projects this/next month or year only after the original start date; calendar-day limits avoid timezone/DST day-length drift. Client projections do not create financial records or scheduled reminders. JavaScript date rollover applies to short months/leap dates. Summary dialogs show activities/descriptions; Dashboard summary can download text. Greeting copy uses clipboard and reports errors.

### Moments and workspace

Events supports name/type/custom-type/notes search, category/Archived filtering and saved date/name/status sorting in one list. The grid mode and view selector are removed; previously stored view preferences are left untouched and ignored. Search stays visible beside Filters; category and sort controls expand in the panel. Normal categories hide archived Moments. EventForm requires name/date, and custom type for Other; repeat options are none/monthly/yearly. Budget exists in the stored model but is not exposed by the shared EventForm.

Cards navigate to workspace and offer Edit, Summary, Archive/Restore and Delete through the compact swipe menu. Workspace hero offers Edit, Archive/Restore and Delete. Share and Duplicate have been removed from routed Moment menus.

Workspace sections are Overview, Activities, Timeline, Memories and Attachments. The five full-label links stay in one row, with compact labels and hidden decorative icons/counts at <=760px. The strip scrolls horizontally if needed and reveals a clipped active link horizontally, without scrolling the page vertically. Section selection recognizes trailing-slash URLs. Overview derives date/status/progress and expense totals, previews activities/latest memory, and offers notes/Memory/Greeting actions. Type and Memory/Greeting controls share a compact hero row. Memories and Attachments put their Add action beside the section heading. Memory titles wrap above a three-line body preview; attachment names use a two-line preview beside metadata. Missing/loading/error records have explicit rendering paths.

Activities embed in the parent event and capture title, date, description, priority; a nonblank title is required. They complete/reopen, cancel/restore and delete. Progress is completed non-cancelled / non-cancelled activities; cancelled items are separated from normal lists. Overdue means unfinished, non-cancelled and before today. Workspace supports search and date/title/priority/status sorting. Transaction actions deep-link to Finance with presets. Link Existing appears inside an expanded existing-expense panel and offers expenses with no activity and either no Moment or this Moment, saving via the transaction coordinator.

Status precedence: archived → explicitly cancelled → completed when at least one active activity exists and all are complete → in-progress. No activities or only cancelled activities means in-progress. Archive does not delete children/money.

Memories embed ID/title/body/created timestamp; creation requires title and deletion uses confirmation. Greetings use configured templates/type flags or saved title/body/updatedAt. Workspace falls back to a generic greeting if template generation returns nothing; disabling generation does not guarantee the manual editor disappears. Download is escaped HTML, not PDF/image. Exported greeting HTML has its own restrictive viewport; main-app pinch zoom policy does not apply to that export.

Sources: [Dashboard](../src/features/dashboard/components/DashboardOverview.jsx), [Events](../src/pages/Events.jsx), [workspace](../src/features/events/components/EventWorkspaceShell.jsx), [form](../src/components/events/EventForm.jsx), [activities](../src/components/events/ActivityList.jsx), [status](../src/utils/eventStatus.js), [greetings](../src/utils/greeting.js), [visibility](../src/utils/dashboardVisibility.js).

## 8. Financial calculations and transaction workflows

Finance has one Transactions screen, three compact **Income / Expense / Balance** summary cards and a single Add Transaction CTA. Transaction history uses content-sized grid rows and a 100px minimum full-card height; the capped list scrolls rather than shrinking cards when many records are loaded. Long titles, links and notes can grow a card beyond that minimum. There are no Income/Expense/Overview tabs. Global Quick Create uses the same form/coordinator. The unified projection preserves separate persistent ledgers and adds `transactionKind` plus namespaced `income:<id>` / `expense:<id>` keys.

- History filters intersect: type, month and case-insensitive substring search across name/title, notes/description, category/type, amount/date and stored event/activity titles.
- Month choices contain recorded months only, newest first, plus All Months. Calendar date prefixes avoid UTC drift. A missing saved month resets only after both stores load.
- History always sorts newest first with namespaced keys for ties. The Sort control is removed and old session sort settings are ignored. Search stays visible beside Filters in one row; type and month live inside the panel. Reset restores All types / All Months / empty search. The button shows an active-options badge, with result count and scope summary below the row; summary cards still follow month alone.
- **Summary cards follow only month**, ignoring search/type. Income/Expense sum finite numeric amounts of their kind. Balance = Income − Expense. All Months uses all loaded transactions. Selecting Expense must not zero the Income card.
- Finance and major reports format INR with Indian grouping and no fractional display digits, although form amounts allow decimals. Currency preference does not provide conversion or universal formatting. Calculations use JavaScript Number, not integer-paise/decimal accounting.

TransactionForm requires nonblank title/category/date and finite amount > 0. Native number input specifies min/step; title max is 140, notes max 3000. Defaults use local today and configured categories; changing kind resets category. Optional Moment precedes optional Activity; changing Moment clears Activity and scopes options. Archived Moments remain selectable. Unavailable old links are displayed, but `requireLinkedActivity` rejects saving orphans. Payload maps title to name, notes to notes/description, income category to type and expense category to category.

`useTransactionManager` uses typed stores and reconciles normalized activity-expense mirrors. Income can retain IDs but never creates an expense mirror. Same-kind edits remove old/rebuild current mirrors. A nested-only account expense updates event aggregate and loaded projection without updating a nonexistent expense document. Type conversion creates replacement, reconciles mirrors, removes original; failures attempt compensation and show recovery errors. Cross-collection writes and compensation are not atomic and may partially fail.

Delete uses confirmation. Activity-linked expenses require an existing activity, remove mirrors then standalone record (or only projection for nested-only records), attempting mirror restoration on failure. Moment-only expenses remain deletable after Moment removal. Income deletion removes its record. Save/delete errors use form messages/toasts; financial load failures show Retry instead of a perpetual skeleton.

Sources: [Financials](../src/pages/Financials.jsx), [history/cards](../src/components/financials/TransactionHistory.jsx), [form](../src/components/financials/TransactionForm.jsx), [filters/calculations](../src/utils/transactionFilters.js), [relationships](../src/utils/transactionRelations.js), [coordinator](../src/hooks/useTransactionManager.js).

## 9. Shared interactions, styling and dialogs

`SwipeActionCard` serves editable Moments/hero, activities, transactions and Code Lists. A horizontal-dominant movement >=44px opens **the same popup in either direction**. Resolver labels other/delete are internal intents; the component only checks intent exists, never deletes on swipe. Cards stay stationary.

The body-portaled glass menu lists available callbacks and optional red Delete last. Width prefers 188px, height caps at 244px with internal scrolling; positioning flips/clamps to visual viewport with mobile bottom clearance. Outside pointer-down, captured page scroll, window/visualViewport resize or Escape dismiss it. Card Enter/Space/Left/Right toggles; menu Up/Down cycles actions, Escape restores card focus. Optional touch vibration and brief post-swipe click suppression are implemented. Transactions, activities and Code List rows allow tap-open; Moment main buttons navigate. Nested controls retain taps except intentional Code List row handling.

Confirmation belongs to callers, not SwipeActionCard. Moments, activities, transactions, memories and attachment removals use parent confirmations. Selecting Delete for an unused Code List value deletes immediately; used values show a warning offering Disable. Do not claim every menu deletion has a second confirmation.

DropdownSelect is a body-portaled combobox/listbox with viewport bounds, above/below placement, focus restore, keyboard navigation and search for >10 options. Its own scrolling does not reposition/jump selection. DateField is native date input; browser controls calendar UI. ModalDialog locks body scroll, focuses Close, handles Escape/backdrop, traps Tab in its DOM subtree and restores prior focus. Portal/modal focus interaction needs browser accessibility checks.

Moments, workspace Activities and Transactions keep search outside a compact Filters disclosure, in the same single row. Only the screen's secondary filters/sort appear inside a desktop dialog or mobile bottom sheet. Changes apply immediately, and Done, Close, Escape or backdrop closes the panel without clearing values. Reset restores that screen's defaults, including empty search. Active search/filter/nondefault sort contributes to the badge; result counts and a one-line scope summary remain below the row. Insights has search and conditional Clear search with its milestone-only scope summary; it has no empty filter panel. Moment categories and financial type/month use native selects inside the modal to keep keyboard focus within it. Form selectors and their option search remain available directly in forms. Scrollbar chrome is hidden globally with CSS while existing scrolling remains enabled for pages, lists, dialogs and dropdowns.

Light/dark use root theme tokens. Primary blue CTAs use muted slate-blue dark surfaces and pale light surfaces with contrasting text, compact labels/padding and no heavy glow. Controls keep 44px touch targets; quick-create buttons are 44px, and mobile form actions no longer stretch unnecessarily. Mobile editor CSS sets a 16px floor at <=1024px with specific Moment Type/Settings/search overrides for Safari focus zoom. Main viewport allows manual zoom. Device keyboard/focus behavior is unverified. Framer Motion modals consult reduced motion and CSS has motion overrides; no comprehensive accessibility or frame-rate certification exists.

Sources: [swipe component](../src/components/common/SwipeActionCard.jsx), [gestures](../src/utils/swipeGestures.js), [menu geometry](../src/utils/swipeMenuPlacement.js), [dropdown](../src/components/common/DropdownSelect.jsx), [date](../src/components/common/DateField.jsx), [modal](../src/components/common/ModalDialog.jsx), [list controls](../src/components/common/ListControls.jsx), [list-control styles](../src/components/common/ListControls.css), [styles](../src/design-system.css).

## 10. Insights, Settings and Code Lists

Insights derives Moment/activity/memory/attachment counts, all-loaded financial totals, categories, six-month activity/spending/memory charts, upcoming/past lists and year groups. Search filters upcoming/past lists, not all totals. Archived there refers to past non-recurring dated Moments in that calculation, not only `event.archived`. JSON export is a report, not recovery backup.

Settings provides profile/session info, defaults, currency/dashboard preference, theme, reminder switches/time, greeting templates, backup and reset. Reminder preferences do not establish background push delivery. Reset All Settings loads/checks records, restores defaults and preserves referenced custom Code List values inactive; it keeps business records. Clear Local Data is separately confirmed and limited as described in section 6.

Code Lists cover Moment types, income types, expense categories, priorities and reminder presets. They support labels, edits, activation/disable and usage-sensitive deletion. Sections are separated by 16px; individual value boxes have 8px gaps and wrapped labels. Descriptions use the section width below the title/action row. Moment types configure greeting template/generation and Show on Dashboard for upcoming Moments, persisted through the existing showInDashboardUpcoming metadata and supported legacy alias. Usage counts use current stores/preferences; the page does not load all domains, so zero usage is not a server-enforced guarantee. Renames do not migrate business records.

Account hydration uses a Firestore transaction and saves use merged setDoc with adminValues/schemaVersion/updatedAt. Valid remote lists, including empty lists, win over browser values. Missing remote settings seed guest/legacy settings or defaults. Schema version 1 migrations add declared defaults without replacing custom entries. Zustand queues saves, scopes responses by owner/revision and rolls back on failure. Code Lists awaits saves and offers hydration retry. The separate Settings `saveAdminValues` handler does not await its promise before success feedback; such feedback is not remote-write proof.

About displays injected version/build timestamp in IST/environment, current release improvements, a guide to reachable flows and factual storage/backup limits. It describes per-type Dashboard visibility, the list-only Moments page, separate search/filter controls, single-row workspace navigation and metadata-only attachments. The speculative roadmap is replaced with Your Data guidance. Refresh attempts worker update, waits for installing/waiting workers when present and reloads. Its wait callback is initialized before its timeout is scheduled; terminal-worker, statechange and timeout cleanup paths have been exercised with a stub worker, not a complete native PWA update journey.

Sources: [Insights](../src/pages/Insights.jsx), [Settings](../src/pages/Settings.jsx), [Code Lists](../src/pages/CodeLists.jsx), [service](../src/services/codeListService.js), [utilities](../src/utils/codeLists.js), [About](../src/pages/About.jsx).

## 11. Attachments and exports

Add Attachment reads only the first selected File's name, type, size, adds ID/timestamp and saves metadata in the event. It does not read/upload bytes, create durable URLs or use Firebase Storage. List displays metadata and confirmed removal. Existing URL fields can supply gallery images, but this upload path does not create them. UI file/keepsake wording is not binary preservation.

Greeting download is HTML. Events contains memory-album handlers: the PDF-labelled branch opens/prints HTML; the Word-labelled branch downloads HTML as `.doc`. Neither is native PDF/DOCX generation. Workspace section lookup exposes no PDF screen; generic print fallback/handler existence is not proof of a reachable export journey. Album HTML interpolates stored text without consistent escaping, an implementation-derived security review gap. Report JSON and summary text are separate from recovery backup.

Sources: [workspace](../src/features/events/components/EventWorkspaceShell.jsx), [Events export handlers](../src/pages/Events.jsx), [download helper](../src/utils/download.js).

## 12. Backup, restore and compatibility

`CURRENT_BACKUP_VERSION = 3`. Settings freshly reads sample fixtures, guest readers or account Firestore and downloads `dn-backup-<date>.json`. Contents: Moments, flattened activities/memories/attachment records, expenses/incomes, Code Lists/version, preferences/settings, favorite/recent IDs and metadata that can include source account UID/name/email. Original attachment bytes, auth credentials/identities, deployed rules and PWA caches are excluded. Application does not encrypt JSON.

Validation requires root object, supported version/date, six collection arrays, configuration objects, valid Code Lists/schema version and unique nonblank string IDs within each collection. Activities/memories/attachments require valid Moment references. This is not exhaustive business validation; amounts/dates/links are not checked like TransactionForm. Expense link problems produce warnings rather than universal rejection; income links lack that warning scan.

Version 2 collection envelopes convert to v3, including supported canonical/old browser keys. Export/conversion normalizes numeric record/link/favorite IDs to strings, strips provider source metadata and promotes nested-only activity expenses into the portable expense array without double-counting an existing standalone record. Unversioned input follows settings-only conversion; arbitrary unversioned business records are not restored. Unsupported explicit versions reject. Settings rejects >50 MB, parses/validates, shows review/conflict policy, then requires restore action.

Restore targets current account/guest regardless of source-account metadata. It rebuilds aggregates, preserves existing values on stable-ID conflicts and appends missing children; matching activities can gain missing nested expenses. Existing standalone income/expense IDs skip; expenses reconstructed under activities are not inserted again as new standalone records. Reconstruction groups expenses by activity ID, so globally unique stable activity IDs matter; validator does not prove expense activity belongs to its stated Moment.

Guest writes aggregates, standalone expenses and merged incomes sequentially; income now persists before reload and standalone expense counts reflect additions. Account reads destination data then sequentially creates missing records/updates aggregates. After records it restores Code Lists unless disabled, preferences and valid favorite/recent IDs, then reloads. Neither mode is atomic or full-import rollback. Failure states already-imported records remain and retries skip matching IDs. Real-account disaster recovery remains unverified; a local guest v2 numeric-ID fixture was restored twice without duplicates or loss after reload. Active samples block restore. New account Moments restored into an all-legacy destination retain that destination collection; source-account metadata never selects a destination.

Sources: [schema/parser/merge](../src/services/backupService.js), [Settings orchestration](../src/pages/Settings.jsx), [backup tests](../src/services/backupService.test.mjs).

## 13. PWA, environment and operations

### Shell caching and installation

[Manifest](../public/manifest.webmanifest) names DN, starts/scopes at `/`, requests standalone portrait display and an SVG any/maskable icon. Installation is browser-provided; no custom beforeinstallprompt interface is implemented. Device installability is untested.

[Vite](../vite.config.js) generates dist/sw.js for production. Cache name combines dn-shell-, package version and build timestamp. Precache includes root/index, manifest/icon, entry/static imports and CSS, not every lazy route. Navigation tries network then cached index/root on network failure. Precache resources are cache-first; other same-origin assets JS/CSS/SVG/fonts cache successful fetches on demand. Activation deletes older DN shell caches and claims clients. Worker handles no cross-origin Firebase requests or domain write synchronization.

Production [main](../src/main.jsx) registers `/sw.js?v=<version>` with updateViaCache none, checks updates, prompts applicable waiting workers and sends SKIP_WAITING from Refresh. Controlled pages reload on controller change. Development registers no worker. [Offline banner](../src/components/common/ConnectivityBanner.jsx) follows navigator online/offline, not backend health. Offline shell does not guarantee unvisited lazy pages or account data; no durable outbox exists.

### Configuration and deployment

Firebase client configuration is embedded in [config](../src/firebase/config.js), targeting the project selected by [.firebaserc](../.firebaserc); no VITE_FIREBASE_* loading. Storage SDK is not initialized. Optional Analytics loads after production window load if supported, catching errors. Auth authorized domains and deployed Firestore permissions need separate verification; no Rules file exists in this tree. Do not record secrets in docs.

Vite derives VITE_APP_VERSION from package.json and build ID from version/timestamp. VITE_DEPLOYED_AT and VITE_DEPLOY_ENV accept process environment overrides; defaults are build/config time and Production/Test based on NODE_ENV. Build labels/timestamps do not prove deployment. Dev/preview bind 0.0.0.0, defaults 5173/4173.

[Hosting config](../firebase.json) serves dist on site dn-10, rewrites SPA paths to index and sets no-cache/no-store headers for index/worker/manifest/JS/CSS. Worker Cache Storage is separate from HTTP cache headers.

[Deployment script](../scripts/deploy-hosting.mjs) increments package/lock patch versions before build, then npm-exec Firebase Hosting deployment. Failure can leave version files changed; never run this as a build check. Explicit owner deployment authorization is required.

[Preview workflow](../.github/workflows/dn-oldversion-firebase-preview.yml) opts in on OldVersion via workflow dispatch or push message containing `[deploy-preview]`, installs/tests/builds, checks FIREBASE_SERVICE_ACCOUNT repository secret and deploys oldversion-usability for 14 days. Preview uses the same Firebase backend. Preview-channel state and repository secrets were not queried; the current live Hosting release is verified below.

## 14. Constraints, errors and unresolved verification

- Preserve DN identity, stable IDs, typed ledgers, nested links, guest/account boundaries and supported backup/browser formats.
- Route boundaries offer Refresh/technical details. Suspected lazy chunk/network errors allow one auto-reload per app version using sessionStorage; storage failures are caught there.
- Cloud CRUD often rolls back state/rethrows, but multi-record financial reconciliation/restore is non-atomic. Guest readers may log malformed data and return empty lists; browser writes can throw. No universal recovery guarantee exists.
- Incomplete Code List usage counts, deletion orphans and guest merge capacity/duplicates remain source-derived limits. Accounts containing both legacy events and canonical eventGroups use canonical records only. Data saved solely in the former app's browser IndexedDB is not imported into Firestore by these compatibility readers.
- Existing signed-in account pages were inspected without business-data writes. The owner's three named transaction examples were already visible with All types/All Months before the patch; these records did not require recreation. Guest legacy restore and filter recovery are browser-tested locally. Fresh login, real account switching/restore, guest migration, cross-device refresh, denied writes, interrupted restore and quota/private browsing remain unverified.
- Deployed rules/cross-user security and Firebase business-data runtime behavior remain unverified. npm ci reports 9 dependency advisories (3 moderate, 6 high), without remediation or exploitability review. Live Hosting release is verified below. Client guards are not server enforcement.
- Native iOS/Android zoom/keyboard/swipe, PWA install/update/offline, comprehensive accessibility and animation performance remain unverified. Browser responsive/theme checks and a selected filter-dialog keyboard journey below are limited desktop-browser evidence, not native-device certification.
- Reminder preferences do not deliver scheduled notifications; metadata does not recover files; report JSON is not recovery backup; successful build is not deployment.
- Documentation governance requires a master update and newest-first changelog entries while preserving historical entry text. Local validation does not establish a GitHub Actions pass or configured branch protection; report those outcomes separately.

## 15. Validation and maintenance

Review date: 2026-10-22. Implementation was reviewed against development base a7f5c26d6e43a971b1461b101f8823129de12cf6 on OldVersion; origin/OldVersion and origin/main matched that base before this release. Node v24.21.0 was used locally. Locked dependencies had already been installed with npm ci; dependency ranges did not change. Local guest/sample journeys and read-only signed-in production journeys were exercised. No production business records or account settings were saved during verification.

| Check | Actual outcome |
|---|---|
| Remote identity and concurrency | PASS: repository https://github.com/Divin-kumar/DN_APP_MAIN.git, local OldVersion at the reviewed base; approved git ls-remote returned matching OldVersion/main references after sandbox DNS failure. Release pushes target only OldVersion |
| npm test | PASS: 143 tests, zero failures, including identity/date/backup compatibility, scoped loading, calendar windows, restored type visibility, route identity, Activity type selection and audit preservation |
| npm run build | PASS: DN 1.0.19, Vite 5.4.21, 2392 modules, generated dist/sw.js. Existing warning for a chunk larger than 500 kB remains |
| node scripts/check-audit-log.mjs a7f5c26d6e43a971b1461b101f8823129de12cf6 | PASS: all 74 historical CHG entries preserved by identifier and text; one new entry first; entire log newest first |
| Audit checker regression tests | PASS: valid migration/subsequent ordering and Windows line endings accepted; historical edits/removal/renaming, duplicates, malformed IDs, oldest-first ordering and missing additions rejected |
| Inline Markdown link/heading checker | PASS: 85 relative links/anchors in README, AGENTS and master resolve, no UTF-8 BOMs. Historical archive links and external URLs are outside this current-document check |
| git diff --check | PASS: no whitespace errors; Git reports LF/CRLF normalization warnings |
| Four-file inventory and DN identity | PASS in npm test; no new Markdown files. Local browser screenshots remain in ignored .verification/ and are not part of the Git release |
| Source reconciliation | Routes, Dashboard type/date callers, picker scope, list/search handlers, stores/services, backup conversion and Hosting/worker configuration inspected; source inspection is separate from browser evidence |
| Dashboard type switch | PASS local isolated fixtures: disabling Birthday removes its upcoming Moment; enabling it restores the same Moment. Guest setting restored after the test. Existing unknown types remain visible by default in utility tests |
| Search and filter layout | PASS local 320px Moments and 390px Finance: search and Filters measured on the same y coordinate with 44px targets and no page overflow. Search changes results; panel contains secondary filters/sort only; Reset restores the list. Desktop Activity row also measured 44px; query survives Activities → Memories → Activities |
| Moments and workspace | PASS: Moments has no view toggle/grid mode. Five workspace links measured in one row at 320px, 390px and desktop; 44px targets. Selecting the clipped final tab adjusts the strip horizontally without resetting vertical position. Memory/attachment heading actions and readable resource cards retained |
| Finance stress/compatibility | PASS local sample list: 672 records retain about 102px minimum cards. Earlier numeric-ID v2 restore/retry journey showed three records with income 18000, expenses 1250, balance 16750; after current fixtures were cleared and the page reloaded, those same original guest records/totals remained. Clearing development samples can leave cached expenses until reload as noted in section 5 |
| Insights and About | PASS local: Insights search stays outside and reveals Clear search only when nonempty, without an empty Filters panel. About shows v1.0.19, current guide and Your Data content; Refresh app reloads successfully. Extracted actual worker-wait source exercised terminal worker, installation statechange, timeout and listener/timer cleanup with a stub worker; full native PWA update acceptance remains unverified |
| Firebase Hosting deployment | PASS: official CLI deploy --only hosting --project expense-tracker-divin --non-interactive found 34 dist files and reported release complete for site dn-10 |
| Live HTTP delivery | PASS: root, About deep link and entry JavaScript return 200. Root/About share the SPA shell; deployed index.html and sw.js match the local 1.0.19 build exactly and worker contains 1.0.19 |
| Signed-in production UI | PASS read-only: Finance has external search beside Filters; About shows v1.0.19/Production and Refresh app succeeds. October workspace shows all five links in one 44px-high row at 390px. Existing Diary, Career and Application and YouTube Dashboard switches were inspected as false; Upcoming consequently shows no Moments. Editors were cancelled, no settings saved |
| Remaining limits | No native iOS/Android keyboard/zoom/swipe, comprehensive accessibility, real account mutation/restore, interrupted writes, deployed cross-user rules audit or complete recovery guarantee. Existing dependency audit from npm ci reported 9 advisories (3 moderate, 6 high); no remediation or fresh exploitability review performed |

Passing tests cover selected utility/service regressions and source contracts; they are not complete integration or device tests. No lint/e2e script is declared. Source additions retain existing ledgers and stable identifiers; no destructive migration or database/rules deployment was performed.

[Governance workflow](../.github/workflows/documentation-governance.yml) runs on OldVersion pushes/target PRs: Node 20 npm ci/test/build, master/changelog diff checks, four-file inventory and newest-first historical preservation. The [audit checker](../scripts/check-audit-log.mjs) uses [entry comparison](../scripts/audit-log.mjs) instead of the superseded append/prefix check. Local checks do not prove a GitHub Actions result or configured branch protection; inspect the release commit's associated checks independently.

Future tasks follow [AGENTS.md](../AGENTS.md): inspect, preserve work, update the present-state master and a new top changelog entry, verify agreement and disclose limits. Existing historical entries remain intact and do not override current behavior.

DN 1.0.19 was published to https://dn-10.web.app on 2026-10-22 using the tested dist build and the official CLI. The release change set contains source, tests, current documentation and the newest-first changelog for the owner's requested Git commit/push on OldVersion. Git history carries the final commit identity rather than embedding this document's own SHA. main is outside the release push. The package/lock patch version changed without dependency changes, and local verification images remain ignored on disk.
