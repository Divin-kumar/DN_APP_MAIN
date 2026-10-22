# DN — MASTER SOURCE OF TRUTH

## Executive Summary

DN organizes Moments, activities, memories, greetings, attachment metadata and finance for Google accounts and browser-local guests. This is the current product reference; rules are in [AGENTS.md](../AGENTS.md), commands in [README.md](../README.md), and execution/release evidence in the [change log](CHANGE_AUDIT_LOG.md).

## Product Overview

React/Vite, Router, Zustand, Firebase Auth/Firestore, Lucide and Framer Motion run without a separate API server. Versions: [package.json](../package.json). Samples are isolated DEV-only fixtures without an account UID.

## Core Business Rules

- Preserve application IDs across links/reloads/backups. Numeric IDs become strings; missing account IDs use provider document IDs. Provider identity includes its collection; runtime routing metadata stays out of backups.
- Account, guest and sample scopes are separate. Matching loaded/active scope keys gate cached data; stale load completions are ignored. Samples take precedence only when explicitly active in development.
- Count each financial ID once within its kind: typed ledger first, unified legacy transactions second, nested activity expenses last. Preserve the first record's values and retain known account document sources for safe mutation. Income never creates an expense mirror.
- Finance totals follow month alone, independent of search/type filters: Income and Expense sum finite amounts; Balance = Income minus Expense. History is newest first. Calculations use JavaScript Number; major totals display INR without fractional digits. Currency preferences do not convert values.
- Transactions require title/category/date and finite amount greater than zero. Activity belongs to its selected Moment; changing Moment clears Activity. Archived Moments remain selectable; saving rejects unavailable links.
- Moment status precedence is archived, explicitly cancelled, completed when all non-cancelled activities are complete and at least one exists, then in-progress. No activities/only cancelled activities means in-progress. Archive keeps children and finance records.
- Dashboard Upcoming includes dates today through 30 calendar days. Archived/cancelled Moments and types with Show on Dashboard disabled are excluded; completed future Moments remain eligible. Missing/unknown flags default visible; legacy `showInDashboard` is supported. Other uses matching custom-type metadata, otherwise generic Other metadata.
- Recurrence projects monthly/yearly occurrences after the original start date; it creates no transactions or scheduled reminders. Local calendar parsing accepts legacy dates/Timestamps; short-month/leap-date projections retain JavaScript rollover behavior.

## Architecture Overview

`page → Zustand action / transaction coordinator → service → Firestore or guest localStorage`. `useAppStore` owns session/preferences/Code Lists; event/income/expense stores own records and scoped loads. Component state holds drafts and filters. Account CRUD is generally optimistic with targeted rollback. Reads use `getDocs` and cache per scope; there are no `onSnapshot` subscriptions, configured persistent Firestore cache, durable outbox or cross-device conflict engine.

Google popup sign-in hydrates Code Lists, attempts guest merge and activates the user with revision guards. Protected routes wait for auth, then allow account/guest access or redirect to login. Code Lists use transaction hydration, merged `setDoc` saves and owner/revision guards.

Firebase client configuration is embedded in [config](../src/firebase/config.js), not `VITE_FIREBASE_*`. [.firebaserc](../.firebaserc) selects `expense-tracker-divin`; [Hosting](../firebase.json) serves `dist` on site `dn-10` and rewrites SPA URLs. No-cache headers match explicit `index.html`, worker, manifest and JS/CSS paths. Optional production Analytics failures do not block the app. Storage SDK is not initialized.

[Vite](../vite.config.js) injects version/timestamp/environment with deployment overrides. Production registers a versioned shell worker: navigation falls back to cached index, core assets are precached and visited `/assets/` JS/CSS/SVG/WOFF/WOFF2 files cache on demand. Activation removes old caches; Refresh handles waiting workers/reload. Development has no worker. Manifest installation is browser-provided; connectivity tracks browser network status. Shell caching does not synchronize Firebase data.

Build commands are in README and governance in AGENTS. Opt-in previews use the same Firebase backend.

## Data Model

| Domain | Account storage | Guest/browser storage |
|---|---|---|
| Moments, activities, memories, attachment metadata, greeting | `users/{uid}/eventGroups` aggregate documents | `dn_guest_eventGroups`; local copy in `dn_session_backup` |
| Standalone income/expense | `users/{uid}/incomes`, `users/{uid}/expenses` | `dn_guest_incomes`, `dn_guest_expenses` |
| Unified legacy finance | `users/{uid}/transactions`, selected by `kind` | No account-to-guest mirroring |
| Code Lists | `users/{uid}/settings/codelists` | `dn_guest_admin_values` plus schema version; legacy hydration keys supported |
| Preferences/theme | Browser-local even for accounts | `dn_preferences`, `dn_theme_choice` |
| Picker/filter state | Browser-local, scoped | Favorite/recent Moment IDs by UID/guest; transaction filters in scoped sessionStorage |

Children are nested arrays with stable IDs and `eventId`/`activityId` financial links. Attachment selection stores name/type/size/timestamps, not bytes or durable URLs; pre-existing URL fields may display images.

Moment reads fall back to `users/{uid}/events` only when `eventGroups` is empty. All-legacy accounts keep that destination for creation/restore; mutations use the source collection. Mixed accounts use `eventGroups`. Finance reads typed/unified records plus nested expenses. Optional legacy permission denial warns; other read errors propagate. Reads do not migrate/delete records or import browser-only IndexedDB data.

Runtime `firestoreId`/`firestoreCollection`/`firestoreSources` route account mutations. Financial sources are restricted to the expected typed collection or `transactions`; duplicate-copy updates/deletes use a batch and retain legacy kind/category fields. New finance uses typed collections regardless of imported metadata. Guest expense writes persist only the standalone ledger.

[Browser migration](../src/utils/storageMigration.js) copies old keys only to absent DN keys and keeps originals. Clear Local Data removes recognized keys of both generations, not cloud/auth data, worker caches or transaction sessionStorage.

## Current Features

| Area | Reachable behavior |
|---|---|
| Dashboard | Greeting, today's count, On This Day spotlight/greeting, upcoming list, summary/text download and Insights link. Spotlight/count use separate date rules from Upcoming. |
| Moments | One list; name/type/custom-type/notes search, category/Archived filter and saved date/name/status sort. Normal categories hide archived records. Form requires name/date and a custom type for Other; stored budget has no shared-form field. |
| Workspace | Overview, Activities, Timeline, Memories and Attachments. Five links stay in one row; clipped active links reveal horizontally. Same-Moment navigation preserves drafts/vertical position, subject to content clamping. Add memory/attachment actions sit beside headings. |
| Activities | Title/date/description/priority, complete/reopen, cancel/restore, confirmed deletion, search/sort. Progress excludes cancelled items; finance actions use the transaction coordinator. |
| Finance | Add/Edit form, Income/Expense/Balance cards, search/type/month filters, recorded months, scoped saved filters, confirmed deletion and load/retry failures. Old sort preferences are ignored. |
| Insights | Derived totals/counts, categories, six-month charts, milestone lists/year groups and report JSON. Search narrows milestone lists only; its past/Archived calculation is not the Moment archive flag. |
| Settings/Code Lists | Defaults, theme/currency/reminder preferences, greeting templates, backup/reset; editable types/categories/priorities/presets with activation and usage-sensitive removal. Moment types control greeting generation/template and Dashboard visibility. Renaming does not migrate records. |
| About/exports | Build/environment, guide/data limits and Refresh. Greetings export escaped HTML; summaries export text; Insights JSON is a report, not recovery backup. |

Moments/Activities/Transactions keep search beside Filters. Secondary options open a dialog/mobile sheet; values survive closing and Reset restores defaults/search. Active count/results/scope stay visible. Insights has search/Clear only. Hidden scrollbars retain scrolling.

Either swipe opens the same menu, never deletion. Moment list offers Edit/Summary/Archive/Restore/Delete; hero omits Summary. Share/Duplicate are absent. Record deletion is confirmed; unused Code List deletion is immediate, used values offer Disable. Portaled dropdowns search long lists; modals manage focus/Escape/backdrop. Themes use muted CTAs, 44px targets and editor zoom guards. Workspace Add activity matches Filters at 44px, 13px/650 text and does not stretch beside wrapped headings.

Routes are defined in [App.jsx](../src/App.jsx):

| Route | Result |
|---|---|
| `/login`; `/`, `/dashboard` | Sign-in/guest; protected Dashboard |
| `/events`; `/activities` | Moments list; redirect to `/events` |
| `/events/:eventId`, `/events/:eventId/overview` | Moment Overview |
| `/events/:eventId/activities`, `/events/:eventId/timeline`, `/events/:eventId/memories`, `/events/:eventId/attachments` | Corresponding workspace section |
| `/events/:eventId/pdf` | Overview fallback; no dedicated PDF screen |
| `/financials`, `/financials/transactions` | Transactions |
| `/financials/income`, `/financials/expenses` | Redirect to Transactions |
| `/insights`; `/settings`; `/settings/code-lists`; `/settings/about` | Reports; Settings; Code Lists; About |
| Unmatched | Redirect to `/` |

## Key Workflows

1. **Session/merge:** Login returns to the requested pathname, default Dashboard, without its query/hash. Guest entry restores local records/settings; logout keeps records. Account initialization batches guest events/finance with fresh provider IDs and stable application IDs, then clears both generations of guest record/mode keys after commit. Merge failure is logged and sign-in proceeds.
2. **Create/edit:** Quick Create opens Moment/Activity/Transaction forms. Activity filters Moments by type, keeps archived/historical choices and clears excluded selections. Workspace consumes `create=activity`; Finance consumes `create=income|expense|transaction` plus optional `event`/`activity` presets. Settings hashes open matching sections.
3. **Finance:** Same-kind edits update source documents/rebuild mirrors; nested-only expenses update their aggregate. Kind conversion creates a typed replacement, reconciles mirrors and removes original documents, attempting compensation on failure. Persisted account expenses remain deletable with unavailable links; guest/nested-only activity links require a parent. Moment/activity deletion does not cascade into standalone finance.
4. **Backup:** Fresh source reads export JSON v3: Moments, flattened children, finance, Code Lists/version, preferences/settings, picker IDs and optional account metadata. Routing fields, auth credentials, file bytes, rules and caches are excluded; JSON is unencrypted. IDs normalize and nested-only expenses appear once. V2 envelopes upgrade; unversioned input is settings-only; unsupported versions reject.
5. **Restore:** Reject files over 50 MB. Validate envelope/date, six arrays, configuration, unique IDs and child-to-Moment references; finance checks are partial warnings. Confirmation targets the active account/guest. Existing values win; missing children append. New mirrors use destination values with matching links or skip stale reattachment. Guest restore preserves raw standalone masters independently of mirrors; corrupt ledgers block writes and nested-only projections stay nested. Sequential record writes precede configuration/reload; partial results remain and retries skip existing IDs. Samples block restore.
6. **Settings:** Remote Code Lists, including empty lists, override browser values; missing settings seed guest/legacy values or defaults. Reset preserves business records/referenced custom values inactive. Clear Local Data is separately confirmed, with Data Model's scope. Reminder preferences do not establish delivery.

## Important Source Files

| Concern | Start here |
|---|---|
| Navigation/session | [layout](../src/layouts/DashboardLayout.jsx), [auth](../src/context/AuthContext.jsx) |
| Dashboard/Moments | [Dashboard](../src/features/dashboard/components/DashboardOverview.jsx), [Events](../src/pages/Events.jsx), [workspace](../src/features/events/components/EventWorkspaceShell.jsx) |
| Compatibility | [event service](../src/services/eventService.js), [account transaction routing](../src/services/accountTransactionService.js), [financial normalization](../src/utils/financialRecords.js) |
| Finance | [Financials](../src/pages/Financials.jsx), [calculations](../src/utils/transactionFilters.js), [coordinator](../src/hooks/useTransactionManager.js) |
| Backup/settings | [backup service](../src/services/backupService.js), [Settings](../src/pages/Settings.jsx), [Code Lists](../src/pages/CodeLists.jsx) |
| Shared UI | [list controls](../src/components/common/ListControls.jsx), [swipe](../src/components/common/SwipeActionCard.jsx), [styles](../src/design-system.css) |

## Known Limitations

- Whole-Moment array writes can overwrite concurrent edits. Scoped loads are not a complete cross-device conflict solution. Financial ledger/mirror reconciliation and restore span separate operations; compensation can fail. Batches synchronize duplicate financial copies, not the entire workflow.
- Guest merge is not deduplicated/chunked; limits/retries can fail or duplicate imports. Sample clearing may leave cached projections until reload. Guest storage failures lack universal recovery.
- Code List usage counts depend on currently loaded stores; zero usage is not a server guarantee. The separate Settings Code List save handler does not await remote completion before success feedback.
- Backup checks do not prove every expense belongs to its stated Moment/activity; orphans can remain. Original file recovery, comprehensive automatic backups and server-delivered reminders are not implemented.
- Deployed rules/cross-user isolation, account mutation/restore, interrupted recovery, native-device/PWA behavior and accessibility need separate verification. Client UID paths are not authorization; this tree has no Rules file.
- Existing album export handlers produce printable HTML or HTML named `.doc`, not native PDF/DOCX; handler existence does not prove a reachable export flow. Inconsistent HTML escaping in those handlers remains a review gap. Offline shell caching does not guarantee unvisited pages/account data.
- Root and rewritten deep-link HTML responses advertise `max-age=3600`, unlike explicit `/index.html`. Cached clients may need About → Refresh app to apply a release; worker caching and HTTP caching are separate.

## Open Work / Future Enhancements

Proposed only: realtime subscriptions, durable offline data and conflict/deletion policy. Synchronization is unimplemented and excluded from this work. Verify/remediate Known Limitations before adding guarantees.

## References

- [Setup/commands](../README.md), [development rules](../AGENTS.md), [newest-first change evidence](CHANGE_AUDIT_LOG.md).
- [Documentation CI](../.github/workflows/documentation-governance.yml), [history checker](../scripts/check-audit-log.mjs), [preview workflow](../.github/workflows/dn-oldversion-firebase-preview.yml).
- Source review: 2026-10-22, base `10639467750f55d62fcc4beabb22c695e9119432` plus this change set. Facts are source-derived unless the changelog identifies execution; tests/mocks do not prove cloud security or deployment.
