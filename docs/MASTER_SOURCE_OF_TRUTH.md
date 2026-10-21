# DN — MASTER SOURCE OF TRUTH

> **AUTHORITATIVE REFERENCE** · Version **2.9.7** · Updated **2026-10-21 (UTC)** · Repository `Divin-kumar/DN_APP_MAIN` · Working branch **`OldVersion`** · Status **SOURCE-INSPECTED / RUNTIME NOT VERIFIED**
>
> **Read first:** [AGENTS.md](../AGENTS.md) (mandatory instructions for human and AI contributors) and [CHANGE_AUDIT_LOG.md](CHANGE_AUDIT_LOG.md) (append-only change register). This master is the **only active normative product/architecture/operations document for `OldVersion`**. Its mandatory documentation governance does not apply to `main` or other branches. `README.md` provides navigation; it does not override this file.
>
> **Inspected application baseline:** commit `f5919b8e4758e4ebadc6cebb85bb54ae3e414dbb` on `OldVersion` (2026-10-19). The 2026-10-21 source audit re-read the major code modules on `OldVersion`. Documentation-only commits after the baseline do not imply a new app build or runtime test. Always check current HEAD before editing.

## Contents

1. [Truth, ownership and verification vocabulary](#1-truth-ownership-and-verification-vocabulary)
2. [Product scope and terminology](#2-product-scope-and-terminology)
3. [Live application architecture](#3-live-application-architecture)
4. [Business behavior and data ownership](#4-business-behavior-and-data-ownership)
5. [Backup, restore and migration](#5-backup-restore-and-migration)
6. [Security, reliability, PWA and operations](#6-security-reliability-pwa-and-operations)
7. [Testing and release contract](#7-testing-and-release-contract)
8. [Approved engineering and AI governance](#8-approved-engineering-and-ai-governance)
9. [Decisions, conflicts and explicit unknowns](#9-decisions-conflicts-and-explicit-unknowns)
10. [Planned and unverified backlog](#10-planned-and-unverified-backlog)
11. [Evidence and source traceability](#11-evidence-and-source-traceability)
12. [Document lifecycle and cleanup record](#12-document-lifecycle-and-cleanup-record)
13. [Version and change history](#13-version-and-change-history)

## 1. Truth, ownership and verification vocabulary

**Scope:** Describes the **currently inspected application**, not a prospective redesign. This document consolidates the prior README, business guide, PRD, architecture descriptions, UI guide, enterprise architecture review, backup/restore review, code-list migration note, engineering rules, project memory and task backlog. The original versions are retained in **Git history** at the audited baseline and are **not alternate authorities**.

**Evidence priority:**
1. Current code, schemas and configuration for **implemented** behavior.
2. Executed tests, live Firebase Rules and deployed environment evidence for **verified** behavior.
3. Product-owner-approved requirements or architecture decisions for intent/policy.
4. This master, updated to agree with (1)–(3).
5. Historical reviews, documents and AI-generated plans, used as provenance only.

**Evidence labels:** `SOURCE-INSPECTED` = code exists, not necessarily exercised; `RUNTIME-VERIFIED` = repeatable executed evidence exists; `PLANNED` = desired, not implemented; `UNKNOWN` = no adequate evidence; `DEPRECATED` = historical and not authoritative. Never silently promote `PLANNED` to `RUNTIME-VERIFIED`.

**Authority/owners:** Repository owner authorizes product priorities and branch/deploy actions; engineering owns source and compatibility; a security reviewer is required before sensitive production-data assurances. These roles are responsibilities, not claims that designated individuals have signed off.

**Long-term AI policy for `OldVersion` only:** Every AI session editing this branch starts with `AGENTS.md`, **this document**, the latest `CHANGE_AUDIT_LOG.md`, then the latest relevant code. Project/chat memory is not a substitute for these files. Git history is the audit-proof source when historical text has been retired.

## 2. Product scope and terminology

### 2.1 Product identity
- **DN is the confirmed and only authoritative product name**, explicitly established by the repository owner on 2026-10-21. The package name is `dn` (version 1.0.15 at this audit). No future AI session may refer to the product using its former name. PWA manifest name and short name are both exactly `DN`, and package name is `dn`. Legacy storage key prefixes and historic filenames exist only for compatibility or evidence.
- **Brand decision: APPROVED.** Preserve external Firebase project IDs and existing user data while standardizing user-facing and newly written code on DN.
- Purpose: responsive personal life planning and lightweight household/personal finance. Supports account and guest experiences. Not a banking ledger or certified archival/notification service.

**Regression enforcement:** `src/brandIdentity.test.mjs` is included in `npm test`. It validates DN in metadata and visible About copy, rejects the retired brand in application files outside the explicitly preserved storage-compatibility bridge, and enforces exactly four Markdown files on `OldVersion`. The audit-history and legacy-data tests remain exempt because they must preserve accurate historical evidence. The test result is not reported as passed until CI executes it.

### 2.2 Canonical domain words
- **Moment / Event:** user-facing occasion or milestone (birthday, anniversary, festival, trip or personal plan).
- **Event group:** actual persistent aggregate named `eventGroups` containing moment details and related activities/memories/attachment metadata.
- **Activity:** a task/action within a moment, with dates, completion, priority and potentially nested expenses.
- **Memory:** note or remembrance linked to a moment.
- **Attachment:** currently **metadata** associated with a moment. Do not promise restoration of file bytes.
- **Expense:** outgoing amount, either independent record or nested under an activity and projected into expense totals.
- **Income:** incoming amount stored independently.
- **Code Lists:** customizable values (event types, income types, expense categories, activity priorities, reminder presets).
- **Guest:** browser-local trial mode; **account:** Firebase-authenticated UID; **sample mode:** isolated developer fixture mode.

### 2.3 Available modules (source-inspected)
| Module | Current implementation | Key source |
|---|---|---|
| Login / guest | Google sign-in, guest session, protected route shell | `src/pages/LoginPage.jsx`, `src/context/AuthContext.jsx`, `src/context/GuestContext.jsx`, `src/routes/ProtectedRoute.jsx` |
| Dashboard | Upcoming moment and financial overview; dashboard widgets | `src/pages/DashboardHome.jsx`, `src/features/dashboard/components/DashboardOverview.jsx` |
| Moments / Events | CRUD, nested workspace, activities, timelines, memories, attachment metadata | `src/pages/Events.jsx`, `src/features/events/components/EventWorkspaceShell.jsx`, `src/store/useEventStore.js` |
| Income | CRUD, category/type and summaries | `src/pages/Income.jsx`, `src/services/incomeService.js`, `src/store/useIncomeStore.js` |
| Expenses | CRUD, financial summaries and nested expense aggregation | `src/pages/Expenses.jsx`, `src/services/expenseService.js`, `src/store/useExpenseStore.js` |
| Insights | Derived event/activity/money summaries, client-side search and JSON export | `src/pages/Insights.jsx` |
| Settings | Preferences, reminder defaults, appearance, backup/export/import, sample scenarios | `src/pages/Settings.jsx`, `src/store/useAppStore.js` |
| Code Lists | Account/guest configurable values and usage-sensitive updates | `src/pages/CodeLists.jsx`, `src/services/codeListService.js`, `src/utils/codeLists.js` |
| About / PWA | App information, install shell, refresh/update notification | `src/pages/About.jsx`, `src/main.jsx`, `vite.config.js` |

**Do not claim shipped:** cloud-wide full-text indexing, durable local-first outbox synchronization, reliable scheduled push reminders, production original-file storage, or comprehensive automatic remote backups. Some routes labelled timeline/PDF are part of a moment workspace; they are not proof of a global timeline engine or archival PDF service.

## 3. Live application architecture

### 3.1 Stack
| Layer | Observed |
|---|---|
| UI | React `^18.3.1`, JSX/ES modules, Lucide; Framer Motion installed |
| Build / test | Vite `^5.4.10`, `@vitejs/plugin-react`; Node built-in test runner (`npm test`) |
| Navigation | `react-router-dom` `^6.28.0`; lazy routes and protected shell |
| Client state | Zustand `^5.0.0`, session contexts and domain stores |
| Account identity/data | Firebase JS SDK `^12.19.0`, Google Auth, Cloud Firestore |
| Guest/preferences | Browser `localStorage` |
| Styling | `src/index.css` followed by `src/design-system.css`, theme via root `data-theme` |
| Hosting | Firebase Hosting configured by `firebase.json`; SPA rewrite to `/index.html`, static `dist` |
| Offline shell | Custom Vite-generated production service worker and `public/manifest.webmanifest` |

A custom separately deployed application REST/GraphQL server is **not present in the inspected repo**. Browser clients call Firebase services directly.

### 3.1a Transactions view and filtering
**Current source implementation:** The financial navigation is now **Overview | Transactions**, with the separate Income/Expense UI tabs and forms removed from routes. Old `/financials/income` and `/financials/expenses` URLs redirect to Transactions for bookmark compatibility. The overview displays filtered summary Income, Expense and Balance (Income − Expense), plus compact recent transactions. Transactions displays Search, Type, Month and Sort with a responsive shared dropdown filter row and a single Add Transaction CTA. All filters intersect; month values originate **only from months holding existing records**. `src/components/financials/TransactionHistory.jsx` renders accessible premium cards with optional activity labels, green/red signed values, Framer swipe-left Edit/Delete reveal, explicit overflow button and optional haptics. Selected filters persist per account/guest session. New/edited transactions use `TransactionForm` with original separate stores beneath the unified UI.

### 3.1a superseded historical context
The current `src/pages/Financials.jsx` has an Overview, Income and Expense navigation rather than a separate Transactions route. The Overview now includes an **additional combined Transactions history** beneath its existing preview cards, preserving the current overview/header/nav. `src/components/financials/TransactionHistory.jsx` merges income and expense store records, retains the original source records and stable ID namespaces, and applies **Search, Transaction Type (All/Income/Expense), and Month (All months/Month Year)** conjunctively via `src/utils/transactionFilters.js`. The search stays in the first toolbar row; the two equal-width filters appear side-by-side with 12px gap, stacking only below 310px. Month options include recorded months plus the previous 12 months, with responsive abbreviated mobile labels. Type and month selections are scoped to the current account/guest and kept in sessionStorage, independent of store refresh or new records. When nothing matches, an empty state appears. Existing preview cards, income/expense modules, navigation and add controls are unchanged. This is source-inspected, with Node filters tests; verify on real mobile/tablet after CI.

### 3.2 Runtime flow
```text
index.html -> src/main.jsx -> BrowserRouter -> src/App.jsx
  -> AuthProvider + GuestProvider -> ProtectedRoute/DashboardLayout
  -> pages / feature components -> Zustand domain stores
  -> service adapters -> Firebase Firestore (account) OR localStorage (guest)
                                  \-> isolated dev sample fixtures when active
```
Firebase Analytics is optional and lazy-loaded in production if supported. The production service worker manages shell caching and checks for updates; it is not a durable domain-write queue.

### 3.3 Route contract
`/login` public; protected application shell: `/`, `/dashboard`, `/events`, `/events/:eventId`, `/events/:eventId/overview`, `/events/:eventId/activities`, `/events/:eventId/timeline`, `/events/:eventId/memories`, `/events/:eventId/attachments`, `/events/:eventId/pdf`, `/financials/income`, `/financials/expenses`, `/insights`, `/settings`, `/settings/code-lists`, `/settings/about`. Standalone `/activities` redirects to `/events`; unknown paths redirect to root. Source: `src/App.jsx`.

### 3.4 Domain stores and services
**CSS branding migration (2026-10-21):** Shared deprecated-prefix class selectors were renamed consistently to `dn-` across both CSS stylesheets and their React consumers. This is a class-name contract change, not a user-data schema change; confirm both light/dark themes and mobile layouts in a browser before deployment.

- `src/store/useAppStore.js`: account, guest, preferences, code-list hydration/writes, notifications.
- `src/store/useEventStore.js`: event lifecycle across sample, guest and account modes, optimistic cloud updates and error rollback.
- `src/store/useExpenseStore.js`, `useIncomeStore.js`: domain CRUD, async loads, sample/guest/account behavior, optimistic cloud updates/rollback.
- `src/store/useDashboardStore.js`: small UI dashboard state.
- `src/services/eventService.js`, `expenseService.js`, `incomeService.js`: schema normalization, Firestore and guest-local persistence.
- `src/services/codeListService.js`, `backupService.js`, `guestMergeService.js`: account settings, backup format, transition from guest data to account.

**Cross-cutting rule:** UI should coordinate via store/service boundaries; do not scatter direct Firestore writes across unrelated components.

## 4. Business behavior and data ownership

### 4.1 Account, guest and sample separation
**Brand-data migration (source migration complete, runtime validation pending): `src/utils/storageMigration.js` copies known former browser-storage keys into canonical `dn_` keys only where no DN key exists; it keeps the old values as a recovery path. New preferences and guest Code Lists are written under `dn_` keys. The compatibility module is the only place that defines the former storage prefix, and it does not define the product name. On successful guest-to-account merge or exit from guest mode, both old and new session keys are cleared, preventing duplicate reimports. Legacy backup v1/v2 settings remain readable. This is source-inspected, not runtime-tested. Explicit local-data clearing removes both generations of app-owned keys.

**Account:** Firebase Auth emits state through `authService.onAuthChange`. Account settings/code lists are hydrated; guest data merge is attempted; account user then becomes active. **Important observed limitation:** `src/context/AuthContext.jsx` logs guest-merge failures to console and then proceeds with `setUser`; a visible recovery/retry UX is not evident in this inspected path. Treat as risk, not successful migration guarantee.

**Guest:** `dn_guest_mode` flag; events, expenses, incomes and code lists are stored in browser localStorage. Changing devices or clearing site storage can lose guest data absent a separate backup. Existing guest event service also uses a session backup key.

**Sample:** `src/dev/sampleData.js` provides an isolated scenario used by stores/settings; **clear it before restoring a real backup**. Sample data is not the same persistence environment as either account or guest.

### 4.2 Firestore paths and keys
| Domain | Account location | Guest/browser location |
|---|---|---|
| Moments / eventGroups | `users/{uid}/eventGroups` | `dn_guest_eventGroups` |
| Standalone expenses | `users/{uid}/expenses` | `dn_guest_expenses` |
| Income | `users/{uid}/incomes` | `dn_guest_incomes` |
| Code Lists | `users/{uid}/settings/codelists` | guest code-list state/localStorage (see `src/utils/codeLists.js`) |
| Preferences / theme | browser-local, including for signed-in users | `dn_preferences`, `dn_theme_choice` |
| Favorite/recent IDs | browser-local and scoped by account ID | `dn_favorite_event_ids_{uid|guest|local}` and `dn_recent_event_ids_{uid|guest|local}` |

UID-scoped collection paths are **client conventions**; they do not replace deployed server-enforced security rules. The repo does not include auditable Firestore Rules in its tree.

### 4.3 Invariants and data risks
- Stable **application record IDs** identify entities across backup/guest merges; Firestore document IDs (`firestoreId`) may differ.
- Event groups can embed activities, memories, metadata and activity-linked expense records. Normalizers provide defaults and computed status.
- `expenseService.js` reads standalone expenses and embedded activity expenses, merging/deduplicating by identifier. **Open decision:** authoritative ownership of nested versus standalone expenses; deleting nested-only projected records may not delete a separate Firestore document.
- Income and expense stores perform optimistic updates with error rollback, but rollback behavior is not a substitute for full integration tests.
- Code-list persistence: Firestore document with `adminValues`, `schemaVersion`, `updatedAt`; transaction-based hydration can incorporate legacy browser values. Guest values remain local; test cross-device consistency and permissions in live Firebase.
- Dashboard and Insights generally derive summaries from domain records; they are not a documented independent persisted system of record.
- UI permits recurring event logic and settings-driven reminder/greeting parameters, but these are **not** evidence of a delivered background notification scheduler.

## 5. Backup, restore and migration

### 5.1 Current schema
**Source-inspected:** `CURRENT_BACKUP_VERSION = 3` in `src/services/backupService.js`. Current exports normalize: `moments`, `activities`, `memories`, `attachments`, `expenses`, `incomes`, `codeLists`, preferences/settings and dashboard configuration. Nested moment fields are flattened into a portable representation and reconstructed on import. Legacy unversioned/v2 shapes have conversion logic; unknown future versions are rejected.

### 5.2 Backup behavior
`src/pages/Settings.jsx` exports from active sample fixtures, account Firestore readers or guest local readers as appropriate, then downloads JSON (name `dn-backup-<date>.json`). Attachment **records and metadata** may be exported, **not original bytes**. Firebase Auth identities, credentials, deployed security rules, Firebase environment and service worker cache are not backed up.

### 5.3 Restore behavior and limits
- Import validates schema/relationships, shows a review state, then merges into the **current** account or guest storage.
- New IDs are added. Existing IDs retain destination record values; missing nested children may be merged into existing event groups. Record counts/conflicts are reported.
- Account restore writes in multiple asynchronous steps, **not an atomic transaction spanning all data**; failures can leave partial state. Retry and reconciliation require manual/automated validation.
- Development sample scenario blocks restore until cleared.
- Settings/code lists and preferences are applied after core record writes succeed. The browser-local configuration is distinct from Firestore account data.
- Real-world data recovery, cross-account isolation, device migrations and retry paths are **NOT RUNTIME-VERIFIED** by this documentation audit.

## 6. Security, reliability, PWA and operations

### 6.1 Security and privacy boundaries
- Client-side route guards, UID paths and optimistic UI are not server authorization.
- **UNKNOWN:** actual deployed Firestore security rules, their test coverage, OAuth allowed domains, Firebase project access roles, App Check policy and production data-retention requirements.
- Do not store admin credentials in frontend, log sensitive payloads without necessity or imply the app is a certified sensitive-data system of record.
- The 2026-10-19 enterprise architecture review previously assessed production readiness unfavorably, but its numerical risk score is an *historical opinion*, not a live penetration test.

### 6.2 Reliability and known hazards
- Nested/standalone expense reconciliation and duplicate IDs need an approved canonical policy.
- Guest->account migration failure is caught/logged; user-facing visibility/retry is insufficiently verified.
- Backup restore can partially succeed; original attachment files are not restored by current schema.
- Browser-local preferences/guest data are not synchronized automatically between devices.
- Large components (notably Settings, EventWorkspaceShell and dashboard) and overlapping CSS require scoped changes and regression checks.
- Date/time and recurrence logic should be covered with timezone and edge-case tests.

### 6.3 PWA and deployment
- `vite.config.js` generates a build-stamped app-shell service worker; `src/main.jsx` registers it in production and prompts to refresh on update.
- No evidence of a durable client outbox, cross-device conflict resolution or guaranteed offline Firestore writes. Describe current offline scope as shell/assets.
- `firebase.json` serves `dist` via Firebase Hosting site `dn-10`, SPA rewrite; several JS/CSS/HTML resources use no-cache headers. Actual deployed target must be verified before deployment.
- **Do not deploy** or change production Firebase configuration without explicit instruction.

### 6.4 Responsive overlays (CI verified; real-device validation pending)
**Final automated verification (2026-10-21):** GitHub Actions [run 39646417362](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39646417362), application commit `f735cf9a2e3c94c1a6301cc097ee3a21840de6d6`, passed `npm ci`, `npm test` (**60 tests passed / 0 failed**), `npm run build` and documentation governance (including exactly four Markdown files and append-only audit). Tested transaction filtering, overlay placement and DN brand regressions as part of the 60 tests. **Not verified:** browser click/touch interactions on actual phones/tablets, native calendar picker behavior across browsers, Firebase security, live transactions, or mobile keyboard/viewport interactions. Build warns about one large chunk. Dependency installation still reported 9 vulnerabilities (3 moderate, 6 high).

**Previous automated verification (2026-10-21):** GitHub Actions [run 39645286731](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39645286731), source commit `68860bb693a594db7726b8d2b7e140afed30219c`, passed `npm test` (**60 passed, 0 failed**), `npm run build` and documentation governance. 9 known package audit advisories (3 moderate, 6 high) remain unresolved. Do not infer manual viewport/device coverage.
Shared `src/components/common/DropdownSelect.jsx` renders options in a body-level portal rather than clipping within scrollable cards/modals. `src/utils/overlayPosition.js` computes an above/below position, clamps to visual viewport (including mobile keyboard offsets), and caps panel height; the scrollable options list has wheel/touch containment, selected-option reveal, long-value search and keyboard Arrow/Home/End/Enter/Escape/Tab behavior. Menu geometry is refreshed for trigger resize, document scroll, orientation and visualViewport resize/scroll. Trigger focus is restored on selection/Escape. DateField continues using the browser-native `input type="date"` picker so viewport positioning, mobile-sheet adaptation and calendar accessibility are provided by the user agent; unlike custom DOM menus, native picker placement cannot be dictated by application JavaScript. Manual browser testing is required for iOS/Android calendar behavior and modals.

### 6.5 Firebase Hosting usability-preview deployment
**Owner authorization:** 2026-10-21, deploy DN from `OldVersion` for usability testing. Use a separate **Firebase Hosting preview channel**, not the production/live channel.

- **Project:** `expense-tracker-divin` (`.firebaserc`), **Hosting site:** `dn-10` (`firebase.json`).
- **Branch:** `OldVersion`; `main` is unchanged.
- **Preview channel:** `oldversion-usability`, expiring 14 days after each deployment.
- **GitHub Actions:** `.github/workflows/dn-oldversion-firebase-preview.yml` builds and tests, then deploys to the preview channel only for a push whose commit message includes `[deploy-preview]` or an explicit workflow dispatch. Ordinary pushes are not deployments.
- **Credential prerequisite:** encrypted repository Actions secret `FIREBASE_SERVICE_ACCOUNT` with Firebase service-account JSON and sufficient Hosting permissions. Never put credentials into Git or audit logs. If missing, the deployment job stops before uploading.
- **Success criteria:** npm dependency install, tests and build pass; Firebase Hosting action reports success and provides a real preview URL. A passing build alone is not a deployment.
- **Risk:** Firebase preview URLs are public to anyone holding the link. A preview app still accesses the same Firebase Auth/Firestore backend as the project, so guest/sample mode is recommended for usability sessions. Google OAuth may need a preview authorized domain.
- **Rollback:** let the channel expire or delete it in Firebase Console. Do not promote to `live` without new approval.
- **Actual deployment status (2026-10-21): BLOCKED.** GitHub Actions preview attempt [run 39648814699](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39648814699), source commit `29e22b8441cad058548836c02b82f6d7a076f853`, passed `npm ci`, 60/60 Node tests and Vite build, then **failed** at `Verify Firebase deploy credentials`: the repository did not supply `FIREBASE_SERVICE_ACCOUNT`. The Firebase deployment and URL publication steps were **skipped**; **no files uploaded and no preview URL created**. In parallel, [documentation governance run 39648814283](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39648814283) passed smoke tests and documentation checks. To resume, connect Firebase in ChatGPT or configure the repository Actions secret `FIREBASE_SERVICE_ACCOUNT` with appropriately scoped Firebase Hosting deployment rights, then rerun the failed preview job. Never invent a URL or represent this as deployed.

## 7. Testing and release contract

**Available commands from `package.json`:**
```bash
npm install
npm run dev
npm test
npm run build
npm run preview
# npm run deploy:hosting  # EXPLICIT DEPLOYMENT AUTHORIZATION REQUIRED
```
Existing Node test files cover selected backup, event, code-list, greeting, dashboard and version/update utilities. `npm test` maps to `node --test`; `npm run build` to `vite build`. There is no claim that this audit ran either command.

**For any functional change:** check path-specific unit tests, build, guest and authenticated journeys where relevant, mobile and light/dark styling, negative data paths, IDs and Firestore rules where applicable; record **PASS/FAIL/NOT RUN with evidence**. Run deployed security and full restore tests before production assertions. The GitHub documentation governance workflow checks both files **only on pushes to `OldVersion` and pull requests targeting `OldVersion`**; it also runs `npm ci`, `npm test` and `npm run build` as a smoke gate. These checks do not validate browser UX, real Firebase access, deployed rules or offline data. Quality and append-only integrity still need human review and branch protections.

**Retried DN regression verification (2026-10-21):** GitHub Actions [run 39643523554](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39643523554) on commit `ecafb3f6b3818d9caa4efc08202db7e9cb454dd8` passed `npm test` (**51/51 passed, zero failed**), `npm run build` (**success**), and both documentation contract and four-file Markdown checks. The three additional tests enforce DN identity across package/PWA/HTML/About, prohibit retired branding in user-facing source, and enforce exactly four Markdown documents. Node/build validation is not real-device, hosted-site or Firebase data-migration validation. As in earlier runs, package installation reported **9 advisories (3 moderate, 6 high)**. Other branches remain unaffected.

**Executed CI verification for DN branding (2026-10-21):** GitHub Actions [run 39642206927](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39642206927), commit `22aa6403bbbc86f0e589d57d0a475571e38a320f`, passed `npm ci`, `npm test` (**48/48 passed**), and `npm run build` (**success**, generated static bundle and `dist/sw.js`). The governance job also passed. This validates unit tests and compilation of the changed source only; it is not a browser/device test, hosted release, or Firebase security/recovery verification. `npm ci` reported **9 dependency advisories (3 moderate, 6 high)**, requiring a separate dependency security review. Production deployment remains unauthorized.

## 8. Approved engineering and AI governance

**MANDATORY: [AGENTS.md](../AGENTS.md) governs every future AI session.**
1. Work only on **`OldVersion`** unless explicitly directed otherwise. `main` remains protected. PR #6 is open historical context, not merge permission.
2. **Every change on `OldVersion` must update this master and append a record to [CHANGE_AUDIT_LOG.md](CHANGE_AUDIT_LOG.md) in the same change/PR. These requirements do not apply to `main` or other branches.** This includes features, fixes, styling, refactors, dependencies, test/config changes, deployments and documentation policy/cleanup.
3. Audit entry must include UTC date, actor, branch, commit/PR, exact paths, reason, before/after, user/data/security impact, commands and actual outcomes, rollback and follow-ups. Never erase old entries; issue a correction entry.
4. **All future plans, decisions and pending work for `OldVersion` go into this document** §10. No separate `tasks.md`, `memory.md` or sprint specifications in the repo.
5. Keep source-inspected facts separate from desired changes. Source files and operational tests must be checked before changing existing logic; no assertions by analogy.
6. Do not edit production, perform destructive data operations, force-push protected branches or merge without explicit user authorization.
7. If an AI cannot write the files, it must plainly report the blocker and produce the proposed master/audit edits. **Never claim undocumented work complete.**
8. Prefer scoped JSX/JavaScript edits, Zustand/store/service patterns, two-space indentation and existing design tokens; preserve migration/rollback behavior. Add context-oriented comments explaining why rather than restating syntax.
9. Update master **semver** (major policy/product contract change; minor substantive implementation; patch correction) and keep change log current.
10. **Strict rule:** never create an additional Markdown file on `OldVersion`, including `.markdown` and alternate casing. Accommodate all knowledge, decisions, requirements, plans and test plans within the existing four. Exactly four active `.md` files on `OldVersion`: `README.md`, `AGENTS.md`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.

## 9. Decisions, conflicts and explicit unknowns

| Topic | Canonical current answer | Decision status and rationale |
|---|---|---|
| Product naming | **DN only** | Owner-approved 2026-10-21. Deprecated historic names are not permitted in UI, product documentation or future AI answers. Migrate storage prefixes safely. |
| Cloud vs local-first | Account = Firestore, guest = localStorage, service worker = shell | **Current reality**; IndexedDB/outbox proposal not shipped |
| Backup v2 vs v3 | **v3 current**; v2 import compatibility | Source constant supersedes stale v2 text |
| Event vs Moment | UI/domain Moment/Event, storage aggregate `eventGroups` | Both names defined; no forced renaming |
| Expense source | Standalone + nested activity expenses read and deduplicated | Canonical write ownership unresolved |
| Restore conflicts | Existing stable-ID records preserved; absent IDs added | Merge-only at high level, can update aggregate with missing child records |
| Security | Firestore Rules unverified, client paths not sufficient | P0 release gap |
| Attachments | Metadata present; original file recovery unsupported | New storage feature requires design and privacy review |
| Automated reminders | UI preferences do not establish background push scheduler | Do not describe as shipped |
| DOCX historical sources | Binary content could not be extracted through GitHub connector | Older copies recoverable via Git; not certified reconciled |

### 9.1 Unified transaction implementation (source migration stage)
The product-owner-approved financial simplification keeps *two underlying existing Firestore collections* (`users/{uid}/incomes` and `users/{uid}/expenses`) and browser guest keys for data compatibility, while the UI transitions to one Transactions flow. `src/utils/transactionFilters.js` now supplies data-only month options, intersection filters, dynamic income/expense/balance totals, sorting, and normalized form payloads. Existing income normalization now preserves optional linked `eventId`, `activityId`, and notes, with the same note preservation for expenses. **No Firestore migration or record deletion** is needed. Activity-linked expense records may also exist nested within event groups; the UI must avoid deleting/editing their only copy and must reconcile relationships. UI work and cross-collection type transitions require follow-up and browser validation.

## 10. Planned and unverified backlog

**Backlog policy:** Only product-owner-approved work should be represented as committed scope; other rows are **candidate work / verification obligations**. Track progress by changing this table and appending an audit entry, not by creating another file.

| ID | Priority | Status | Work / acceptance criterion |
|---|---|---|---|
| K-01 | P0 | UNKNOWN | Obtain and review deployed Firestore Rules; emulate unauthorized cross-UID access and document results |
| K-02 | P0 | PLANNED | Run existing `npm test` and `npm run build`, record outputs and regressions |
| K-03 | P0 | PLANNED | Exercise real account and guest backup-v3 export/restore, duplicate-ID retry, partial failure and cross-device recovery |
| K-04 | P0 | PLANNED | Decide expense canonical ownership and validate nested/standalone deletion/migration semantics |
| K-05 | P0 | PLANNED | Add explicit user-facing failure/retry workflow for guest-account data merge |
| K-06 | P1 | SOURCE-INSPECTED; VERIFY | Official brand is DN only. Visible branding and new localStorage keys migrated in source; run browser tests to verify saved settings, guest session, data and v1/v2 backup compatibility |
| K-07 | P1 | DECISION NEEDED | Choose cloud-first vs offline-first goals; design sync/outbox only if required |
| K-08 | P1 | PLANNED | Improve CI checks, versioning, deployment approval and Firebase rules test automation |
| K-09 | P1 | DECISION NEEDED | Decide original-file attachment storage, encryption, export, retention and deletion policy |
| K-10 | P1 | PLANNED | Regression tests for recurring dates, timezone, financial reconciliation and code-list migrations |
| K-11 | P2 | PLANNED | Decompose oversized feature screens and reconcile overlapping styles without visual regressions |
| K-12 | P2 | UNKNOWN | If unique requirements from archived Word files are needed, recover old versions from Git and review manually |
| K-13 | P1 | PARTIAL | Documentation workflow ran successfully; require it in `OldVersion` branch protection to prevent bypass |
| K-14 | P1 | PLANNED | Review and triage dependency security advisories from CI (`npm ci`: 9 total, 3 moderate/6 high); avoid unreviewed breaking `npm audit fix --force` |

## 11. Evidence and source traceability

**Application code inspected (GitHub `OldVersion`, 2026-10-21):** `package.json`, `firebase.json`, `vite.config.js`, `src/App.jsx`, `src/main.jsx`, `src/firebase/config.js`, `src/context/AuthContext.jsx`, `src/context/GuestContext.jsx`, `src/routes/ProtectedRoute.jsx`, `src/services/firebase.js`, `src/services/eventService.js`, `src/services/expenseService.js`, `src/services/incomeService.js`, `src/services/codeListService.js`, `src/services/guestMergeService.js`, `src/services/backupService.js`, `src/store/useAppStore.js`, `src/store/useEventStore.js`, `src/store/useExpenseStore.js`, `src/store/useIncomeStore.js`, `src/store/useDashboardStore.js`, `src/pages/Settings.jsx`, `src/pages/CodeLists.jsx`, `src/pages/Insights.jsx`. Remaining page/component trees were inventoried; not all were line-by-line inspected.

**Historical documentation reviewed and consolidated:** `README.md`, `BUSINESS_GUIDE.md`, `architecture.md`, `design.md`, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE_REVIEW.md`, `docs/BACKUP_RESTORE_REVIEW.md`, `docs/CODE_LIST_PERSISTENCE.md`, `docs/DOCUMENTATION_STANDARDS.md`, `memory.md`, `prd.md`, `rules.md`, `tasks.md`. Retrieve pre-cleanup versions by browsing [audit baseline commit](https://github.com/Divin-kumar/DN_APP_MAIN/tree/f5919b8e4758e4ebadc6cebb85bb54ae3e414dbb).

**Binary provenance:** archived Word product-spec file (exact original path in Git history), archived Word system-overview file (exact original path in Git history), `Bugs_OCT26/New Microsoft Word Document.docx` and `Bugs_OCT26/~$w Microsoft Word Document.docx` were inventoried but not text-readable through this connection. No claims from their bodies appear in this master. Git history, not this summarized document, is their recovery mechanism.

**Section-to-source index:**
- §2: `src/App.jsx`, `src/pages/`, `src/features/`, prior PRD/business guide.
- §3: `package.json`, `src/main.jsx`, `src/App.jsx`, `vite.config.js`, `src/firebase/config.js`, `firebase.json`.
- §4: `src/context/`, `src/store/`, `src/services/*Service.js`, `src/dev/sampleData.js`.
- §5: `src/services/backupService.js`, `src/pages/Settings.jsx`, historic backup review.
- §6: `src/routes/ProtectedRoute.jsx`, `src/context/AuthContext.jsx`, `vite.config.js`, `firebase.json`, historic architecture review.
- §7: `package.json`, `src/**/*.test.mjs`; tests not executed by this audit.
- §8: `AGENTS.md`, `.github/workflows/documentation-governance.yml`, change audit.
- §9–10: source evidence plus prior architecture/backup reviews; future decisions not yet approved.

## 12. Document lifecycle and cleanup record

**COMPLETED inventory:** The `OldVersion` working tree contains **exactly four Markdown documentation files**, and **zero DOCX files**, as confirmed by GitHub recursive tree inspection on 2026-10-21. The four and their distinct responsibilities are:
1. `README.md`: orientation, run commands and navigation, never normative app behavior.
2. `AGENTS.md`: mandatory instructions for AI/coding agents editing `OldVersion`.
3. `docs/MASTER_SOURCE_OF_TRUTH.md`: this sole authoritative product/architecture/plans and operational contract.
4. `docs/CHANGE_AUDIT_LOG.md`: append-only factual history of changes to `OldVersion`.

**Retired Markdown documents (16 total):**
- Previous cleanup: `docs/ARCHITECTURE.md` and `memory.md`.
- Current governance reset: `BUSINESS_GUIDE.md`, `architecture.md`, `design.md`, `docs/AI_READY_KNOWLEDGE_BASE.md`, `docs/ARCHITECTURE_REVIEW.md`, `docs/BACKUP_RESTORE_REVIEW.md`, `docs/CODE_LIST_PERSISTENCE.md`, `docs/CONSOLIDATION_SUMMARY.md`, `docs/DOCUMENTATION_STANDARDS.md`, `docs/DUPLICATE_OBSOLETE_REPORT.md`, `docs/RETENTION_DELETION_MATRIX.md`, `prd.md`, `rules.md`, `tasks.md`.

**Retired Word documents (4 total):** archived Word product-spec file (exact original path in Git history), archived Word system-overview file (exact original path in Git history), `Bugs_OCT26/New Microsoft Word Document.docx`, `Bugs_OCT26/~$w Microsoft Word Document.docx`. These were **not text-reviewed**, because the connected GitHub reader could not decode the binary contents. They were removed from the *working tree only* under the owner's cleanup instruction; their original binary versions remain in Git history at `f5919b8`. **Important completeness caveat:** The master was built from inspected code and 13 read Markdown source files, *not* a completed content reconciliation of the archived Word files.

**Removal provenance:** full per-path SHA ledger in [CHANGE_AUDIT_LOG.md](CHANGE_AUDIT_LOG.md) under `CHG-20261021-002` and `CHG-20261021-004`. Do not restore historic sources as new active documents; extract relevant approved facts into this master and record the import as a new audit entry instead.

**Clean repository rule:** no future `.md` policy/roadmap duplicates. `docs/` contains only the master and audit. Keep `.json`, `.js`, `.jsx`, `.css`, `.yml` and required app assets as executable code/config, not duplicate knowledge docs. Any unavoidable compliance artifact requires owner sign-off and an indexed master/audit entry.

## 13. Version and change history

| Master version | UTC date | Meaning | Audit evidence |
|---|---|---|---|
| 1.0.0 | 2026-10-21 | First consolidated master and reports | CHG-20261021-001 |
| 1.0.1 | 2026-10-21 | Early redundant-doc deletions and README pointers | CHG-20261021-002 |
| **2.9.7** | **2026-10-21** | Removed activity-level expense-only creation forms and routed all activity financial creation to unified Add Transaction with preserved activity context | **CHG-20261021-042** |
| **2.9.6** | **2026-10-21** | Supported activity-to-unified-transaction deep links with preselected linked event and activity | **CHG-20261021-041** |
| **2.9.5** | **2026-10-21** | Refined shared Activity swipe detection with axis lock, safe thresholds, and touch-only optional haptics | **CHG-20261021-040** |
| 2.9.4 | 2026-10-21 | Preserve saved month until scoped data loads, suppress cross-account stale transactions, format dates locally for forms | **CHG-20261021-039** |
| 2.9.3 | 2026-10-21 | Added theme-token overflow menu styling and shared 44px button/focus targets | **CHG-20261021-038** |
| 2.9.2 | 2026-10-21 | Replaced event workspace hero delete icon with unified five-action menu and edit modal | **CHG-20261021-037** |
| 2.9.1 | 2026-10-21 | Corrected grouping in archived-safe activity picker filter | **CHG-20261021-036** |
| 2.9.0 | 2026-10-21 | Replaced detached Event card swipe icons with overflow menu, archive filtering and duplicate/share actions | **CHG-20261021-035** |
| 2.8.5 | 2026-10-21 | Implemented reversible archived event metadata and status, separate from canceled/completed | **CHG-20261021-034** |
| 2.8.4 | 2026-10-21 | Added shared accessible five-action event overflow menu with viewport-aware popup placement | **CHG-20261021-033** |
| 2.8.3 | 2026-10-21 | Created safe event duplication/share helpers; duplicates exclude booked money and binary attachments | **CHG-20261021-032** |
| 2.8.2 | 2026-10-21 | Unified the global quick-create financial flow under Add Transaction, removed Expense-only quick-create form | **CHG-20261021-031** |
| 2.8.1 | 2026-10-21 | Added premium theme-adaptive financial card, filter, button, and unified form styles with mobile breakpoints | **CHG-20261021-030** |
| 2.8.0 | 2026-10-21 | Updated financial routing to Overview and Transactions, connected the unified form, dynamic filtered summaries, and premium transaction cards | **CHG-20261021-029** |
| 2.7.3 | 2026-10-21 | Introduced premium unified Transaction cards with swipe/keyboard actions, plus combined filter controls | **CHG-20261021-028** |
| 2.7.2 | 2026-10-21 | Introduced unified transaction mutation coordination, linked-expense reconciliation and nested-only expense safe path | **CHG-20261021-027** |
| 2.7.1 | 2026-10-21 | Created unified, validated transaction form with activity linking for both income and expenses | **CHG-20261021-026** |
| 2.7.0 | 2026-10-21 | Began unified transaction layer without migrating existing account/guest records; removed empty months and added dynamic totals/sorting/notes/link preservation | **CHG-20261021-025** |
| 2.6.6 | 2026-10-21 | Logged failed Firebase preview attempt: tests/build passed, deployment blocked by missing credential, no upload | **CHG-20261021-024** |
| **2.6.5** | **2026-10-21** | Added opt-in non-live Firebase Hosting usability-preview workflow scoped to OldVersion, with credential and validation gates | **CHG-20261021-023** |
| **2.6.4** | **2026-10-21** | Captured verified 60-test/build/governance pass after final dropdown-scroll correction; recorded browser/mobile limitations | **CHG-20261021-022** |
| 2.6.3 | 2026-10-21 | Prevented dropdown internal scrolling from triggering viewport reposition and selected-option jump | **CHG-20261021-021** |
| 2.6.2 | 2026-10-21 | Aligned Transaction Type reset option label exactly with All; combined filters unchanged | **CHG-20261021-020** |
| 2.6.1 | 2026-10-21 | Verified overlay/transaction CI success (60 tests and production build); scoped accessible listbox role to options list | **CHG-20261021-019** |
| 2.6.0 | 2026-10-21 | Added combined Transactions history to existing Financials overview, paired Type and Month filters, search integration and session persistence | **CHG-20261021-018** |
| 2.5.0 | 2026-10-21 | Added portaled, viewport-aware shared dropdown positioning and option search; preserved native calendar controls and theme | **CHG-20261021-017** |
| 2.4.7 | 2026-10-21 | Verified three new DN identity/Markdown tests and build in GitHub Actions (51 pass); removed retired product label from normative AGENTS instructions | **CHG-20261021-016** |
| 2.4.6 | 2026-10-21 | Corrected Node brand-regression test escaping and made source/Markdown scans robust on paths | **CHG-20261021-015** |
| 2.4.5 | 2026-10-21 | Add source-based DN branding and four-file budget regression checks to Node test suite | **CHG-20261021-014** |
| 2.4.4 | 2026-10-21 | Verified repaired DN implementation through GitHub CI (48 unit tests pass, Vite build succeeds); tracked dependency advisories and remaining runtime checks | **CHG-20261021-013** |
| 2.4.3 | 2026-10-21 | Repaired backup v1/v2 parser syntax after GitHub CI identified duplicated replacement text; restored original implementation plus DN/legacy compatibility | **CHG-20261021-012** |
| 2.4.2 | 2026-10-21 | Clarified DN-exclusive future AI instructions, removed retired selector name from normative prose, added `OldVersion` Node test/build CI verification | **CHG-20261021-011** |
| 2.4.1 | 2026-10-21 | Finalized DN PWA manifest name and Node-compatible migration import; renamed archival insights filename; removed obsolete local-only requirements extraction script | **CHG-20261021-010** |
| 2.4.0 | 2026-10-21 | Switched account/guest storage, settings, and backups to DN keys; resolved guest-merge resynchronization trap; preserved legacy backup reads | **CHG-20261021-009** |
| 2.3.0 | 2026-10-21 | Introduced DN browser-key migration and canonical preferences/Code Lists; never overwrite existing DN records or delete legacy data implicitly | **CHG-20261021-008** |
| 2.2.0 | 2026-10-21 | Renamed internal CSS class selectors and matching React classNames from deprecated brand prefix to DN, without changing layout behavior | **CHG-20261021-007** |
| 2.1.0 | 2026-10-21 | Owner-approved canonical brand **DN**; renamed visible application copy and package metadata; deprecated former product name for future AI work | **CHG-20261021-006** |
| 2.0.2 | 2026-10-21 | Scope correction: AI instructions and CI audit policy apply to `OldVersion` only | **CHG-20261021-005** |
| 2.0.1 | 2026-10-21 | **Four-file cleanup confirmed (16 Markdown and 4 DOCX retired), deletion ledger, CI append-only protection** | **CHG-20261021-004** |
| 2.0.0 | 2026-10-21 | Code-inspected master, one-document authority, 4-file policy, mandatory AI/audit workflow, planned work moved into master | CHG-20261021-003 (completion recorded in later entry) |

**Version discipline:** major version for major scope/governance/contract change; minor for implemented feature changes and approved new behavior; patch for corrections. Every update links to an **append-only** audit record; do not retrospectively edit log entries. No unverified plans are promoted into factual current state.
