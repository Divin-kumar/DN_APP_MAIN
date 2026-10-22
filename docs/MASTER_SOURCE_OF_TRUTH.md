# DN — MASTER SOURCE OF TRUTH

> **AUTHORITATIVE REFERENCE** · Version **2.15.6** · Updated **2026-10-22 (UTC)** · Repository `Divin-kumar/DN_APP_MAIN` · Working branch **`OldVersion`** · Status **SOURCE-INSPECTED / RUNTIME NOT VERIFIED**
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
| Income storage | Income records in unified Transactions UI with existing typed account/guest persistence | `src/pages/Financials.jsx`, `src/components/financials/TransactionForm.jsx`, `src/services/incomeService.js`, `src/store/useIncomeStore.js` |
| Expense storage | Expense records in unified Transactions UI with nested activity expense compatibility | `src/pages/Financials.jsx`, `src/components/financials/TransactionHistory.jsx`, `src/services/expenseService.js`, `src/store/useExpenseStore.js` |
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
**Current source implementation:** Finance now has a **single Transactions workspace** with no Overview, Income, or Expense tab; the same screen renders for `/financials` and `/financials/transactions`, preserving bookmarked links and transaction deep-link creation. Old `/financials/income` and `/financials/expenses` URLs redirect to Transactions for bookmark compatibility. The dedicated Overview content, summary cards, and recent-transaction preview have been removed by owner request; filtering and totals utilities remain available to other reporting surfaces. Transactions displays Search, Type, Month and Sort with a responsive shared dropdown filter row and a single Add Transaction CTA. All filters intersect; month values originate **only from months holding existing records**. `src/components/financials/TransactionHistory.jsx` renders accessible premium cards with optional activity labels, green/red signed values, Framer swipe-left Edit/Delete reveal, explicit overflow button and optional haptics. Selected filters persist per account/guest session. New/edited transactions use `TransactionForm` with original separate stores beneath the unified UI.

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

### 9.1 Unified transaction implementation
**Final CSS baseline-test scope correction (v2.15.6, SOURCE-INSPECTED):** The previous 2.15.5 CI run 39709793563 passed the targeted Greeting Template tests and the expanded search-field guards, but one old baseline assertion still counted all later `font-size:16px` rules and incorrectly expected exactly one. The test now scopes the initial general mobile editor guard to its own CSS block before the v2.15.4 targeted patch. The required CSS was already present and does not change in 2.15.6. Final CI/build pending; native iPhone Safari device zoom still unverified.

**Final form-focus zoom audit (2.15.5, SOURCE-INSPECTED):** Initial 2.15.4 GitHub Actions run [39709571162](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39709571162) passed the new Moment Greeting Template CSS-specificity test but failed one obsolete source test that required the original global 16px guard to be the very last stylesheet rule; the new targeted override correctly followed it. The old test now checks that the general guard is followed by the specific Moment rule and additional mobile search-field guards. The audit also found high-specificity `event-search`, `activity-search-field`, `insights-tools`, `code-list-add-row`, `settings-tag-input-row`, and `activity-event-search` text inputs which could override the global mobile font floor. A final <=1024px stylesheet rule now ensures these remain at least 16 CSS px too. All other non-editor typography stays compact, and the user can still pinch to zoom. No JavaScript scale reset or viewport restriction is introduced. Code, tests/build pending new CI; real iPhone Safari input focus and browser keyboard remain NOT RUN.

**Greeting Template remaining Safari focus zoom fixed (2.15.4, SOURCE-INSPECTED):** The user's follow-up screenshot showed iPhone Safari still auto-magnifying the Code Lists **Edit Moment Type → Greeting Template** textarea. Root cause: the Moment Type form sets `font-size:var(--font-body) !important`, where `--font-body` is 14px, at greater selector specificity than the general v2.15.3 mobile 16px editor rule. A final mobile-only (<=1024px) override now repeats the specific Moment type input/select/textarea selector and applies `font-size:16px !important`; it also protects Settings greeting textareas from similar regressions. Both overrides occur after the legacy CSS, retaining the compact font in non-editable labels, buttons and preview fields. No viewport zoom restrictions, JavaScript scroll/scale resets, or forced blurs are used. Existing transactions, Moment categories and all Firebase persistence remain unchanged. Added source regression tests for selector precedence and preserved pinch zoom. Source automated CI/build pending; actual iOS keyboard focus/viewport scale and 320px+ on-device acceptance remain NOT RUN.

**Mobile form focus-zoom prevention (2.15.3, SOURCE-INSPECTED):** An iPhone Safari screenshot of Add/Edit Transaction showed the browser visually zooming when its Title input received focus. DN's inherited field typography often falls below WebKit's ~16 CSS px zoom threshold. A final stylesheet rule now gives editable `input` (text, numbers, search, dates and other editor types), `textarea`, `select` and contenteditable elements **at least 16 CSS px** across mobile/tablet viewport widths (<=1024px), overriding older smaller field rules. Checkboxes, radio, range, file/color/hidden and button-like input controls are excluded so their visual size is not disturbed. The override covers shared form/drawer and searchable dropdown fields as well as Finance. Neither the viewport meta tag nor zoom controls are changed: manual pinch-to-zoom and accessibility magnification remain possible. Preventing low-font-size focus zoom is more reliable than programmatically trying to reset Safari's page scale after an input loses focus, which is unsupported/inconsistent. No transaction or Firebase data code is changed. Source tests and CI build pending; live iOS Safari, text-size accessibility settings and hardware keyboard behavior NOT VERIFIED.

**v2.15.2 source CI correction:** The abbreviated Finance description intentionally superseded the earlier long swipe hint. A previously added source contract still expected the removed hint and made v2.15.1 CI fail one of 108 tests despite the intended markup. The test now asserts the new brief description. A selector was also corrected to target the `transactions-panel dn-transactions-page` element itself, ensuring compact panel padding is applied rather than silently skipped. Code/build and docs regression checks pending on this patch.

**Compact financial information hierarchy / inline Moment utilities (2.15.1, SOURCE-INSPECTED):** On the single Transactions workspace, Income, Expense and Balance stay in **one low-height three-column row** with reduced padding/gaps, minimal border and no heavy card shadow. The separate visible month-period heading is removed to eliminate empty vertical space; an accessible `aria-label` still identifies the summary period, and the same selected-month totals/formulas and account/guest store loading isolation are retained. Immediately below, the Transactions title, **one-line** short definition ('All income and expenses') and **Add Transaction** button occupy one compact responsive header row. On narrow screens, the definition truncates rather than wrapping; the CTA remains a 44px minimum hit target. In the Moment/Event detail hero, the Moment **type/kicker is moved into the same first row** as the Memory and Greeting utilities, which have smaller 17px Lucide icons, no heavy shadows, tighter 44px-high touch controls, and labels hidden only at extremely narrow widths (<=360px), while remaining accessible by aria-label. The formerly separate utility-only top row and its dead space are removed. All click handlers, swipe popup implementation, Moment Grid, transaction persistence, and financial calculations remain unchanged. Unit/source-contract CI and build pending; actual visual layout on iPhone and Android devices not yet measured.

**Compact two-direction card action popup (v2.15.0; SOURCE-INSPECTED):** The owner's latest preference supersedes distinct left/right trays and the prior oversized full-card overlay. A deliberate left OR right swipe on any editable Moment card (List and unchanged Grid), Moment detail hero, Activity, Transaction or Code List now opens **the same small, fixed-position glass popup** containing only actions available for that card. Delete is the **last, red-accented menu item**, alongside Edit/Share/Archive/etc as relevant; a swipe never performs Delete and existing parent confirmations still apply. Cards remain stationary. The popup uses a 188px preferred width, scrollable 244px height cap, 42px menu rows, backdrop blur and subtle entry animation, and computes placement using the visual viewport with bottom navigation clearance, flipping above the card when space is limited. It closes on outside taps, scrolling, viewport resizing or Escape; keyboard Enter/Space/Left/Right can open it and ArrowUp/Down navigate items. Existing tap-to-reveal for Code Lists/Transactions/Activities remains. Touch/Pointer input continues to use axis-dominant swipe recognition, with optional supported-browser vibration and reduced-motion support. The underlying record model, linked Moment/Activity relationships, account/guest isolation, backup schema and all action callbacks are unchanged. Source/geometry automated tests and build pending; native iPhone/Android device behavior and 60fps performance remain **NOT VERIFIED**.

**v2.14.2 nested tap safety:** Shared card taps now ignore nested activity, navigation, expense-disclosure and other interactive descendants, while the Code List primary row remains a tap-to-reveal control. This prevents the action tray from opening when a user taps an existing Activity or Moment button. The preceding shared-swipe commit passed 100/100 tests, build and governance in GitHub Actions run 39705631114. This final nested-tap change has its own CI.

**v2.14.1 test repair:** The automated UX contract follows the new architecture: TransactionHistory delegates accessible Arrow/Enter/Escape keyboard interaction to the shared `SwipeActionCard`; its regression test now checks the actual shared handler rather than legacy per-card code. Left action tray scrolling begins with the first action visible on narrow Moment grid cells, rather than flex-end overflow clipping. Prior v2.14.0 CI failed a stale source assertion, not an application execution assertion; this new version requires fresh CI confirmation.

**Unified mobile swipe overhaul v2.14.0 (SOURCE-INSPECTED):** User's real iPhone Safari screenshots showed the Code List Delete control rendered on an extra row and Moment hero icons unreadably small; earlier source-only patches were insufficient. Moments (List/Grid and detail hero), Activities, Transactions and Code Lists now share `SwipeActionCard` with one `resolveSwipeGesture` recognizer. Touch input is captured via native Touch Events (including swipes beginning on a main card button), mouse/pen via Pointer Events. A 44px axis-dominant horizontal gesture reveals a stationary, full-card glass action overlay; swipe left = non-destructive actions, swipe right = Delete. Reveal is not execution; actual buttons remain explicit and retain existing parent deletion confirmation. Main card keeps its place, with a subtle reduced-motion-aware scale animation. Touch devices may optionally vibrate when supported; iOS Safari is not promised native haptics. Code Lists no longer inserts a second DOM action row or changes card height when revealing actions. Moment detail Memory and Greeting header controls now use 21px icons and minimum 48px targets with visible text, replacing the screenshot's tiny icon-only squares. Grid layout and Moment List's removed rail/dots remain intact. No persistence, schema or security rule changes. CI tests/build pending; real iPhone/Android, screen reader, performance frame timing and deployed preview acceptance NOT VERIFIED.

**v2.13.1 gesture/layout repair (SOURCE-INSPECTED):** Finance summary cards now remain in one compact responsive row even below 560px. Transactions now call the defined `resolveDirectionalSwipe` resolver rather than the stale removed symbol in the drag-end callback. Moment swipe cards use axis-dominant pointer-release recognition to avoid browser drag conflicts; reveal-only controls preserve left-other/right-Delete and confirmations. Code List rows remain stationary while directional glass action trays fade into view, replacing the earlier row-slide transform. All changes are UI/gesture-only; real touch-device and animation frame-time profiling remain NOT RUN.

**Owner gesture correction v2.13.0 (SOURCE-INSPECTED):** Moments list and detail now remove mounted 3-dot controls in favor of swipe surfaces; other actions (Edit/Duplicate/Share/Archive/Restore and Summary when applicable) reveal on left swipe, explicit Delete on right swipe. Transactions, Activities and Code Lists now follow the same directional convention. Gestures reveal only; existing delete confirmation remains. Moment List has no decorative left border or dots; Grid card visual layout preserved. Shared axis threshold requires deliberate directional movement, and supported touch browsers may vibrate. Reduced-motion and keyboard arrow access are included. Real-device, accessibility, frame-rate and live Firebase QA are not performed by source tests.

**Finance Moment-link final CI confirmation (2.12.2):** GitHub Actions [run 39664033801](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39664033801) for exact application source commit `9ff53068e213e52e97e84e05ee1193258a33f3b3` completed successfully with `npm test` **99/99 passed, 0 failed**, `npm run build` **PASS**, and mandatory documentation governance **PASS**. The 2.12.0 precursor also passed 97/97 on run 39663726896. These are automated source tests only; screenshot/real-device accessibility, performance/haptic verification, live account/guest financial recovery, Firestore Security Rules and Firebase deployment were NOT performed. Existing npm advisories (3 moderate, 6 high) and Vite chunk warning remain outstanding.

**Moment-only card and deletion safeguards (2.12.1; SOURCE-INSPECTED):** Transaction cards now show `Moment: <title>` whenever a transaction carries `eventId`, including Moment-only links with no activity, and show a separate activity line when present. A historical missing Moment displays an explicit unavailable label rather than silently dropping the link. Deletion of an expense linked to a Moment but not an activity no longer requires that Moment to remain loaded; no nested activity mirror exists to protect in that case. Activity-linked expense deletions still require a valid linked activity and continue through mirror reconciliation. GitHub Actions [39663726896](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39663726896) for initial 2.12.0 implementation passed **97/97 Node tests, build and audit governance**. This follow-up card/deletion adjustment has new source regression tests, pending CI. Live Firestore/manual-device verification remains open.

**Finance totals and cascading Moment → Activity transaction link (v2.12.0, SOURCE-INSPECTED):** Finance remains one Transactions workspace without Overview navigation, but now restores compact top **Income / Expense / Balance** tiles. Their figures are derived from existing persisted income and expense records for the selected month, independent of list-only search, income/expense type and sorting; Balance = Income minus Expense. They render only after both scoped ledgers load, not during account/guest transitions or load errors. The Add/Edit Transaction form now offers **Linked Moment (optional)** followed by **Linked Activity (optional)**, whose choices include only the selected Moment's activities; selecting a different Moment resets activity, and a transaction may be unlinked, Moment-only, or Moment+Activity. Existing valid linked records and deep-link presets populate both selectors; historical deleted Moments/activities retain a visible unavailable placeholder until repaired. The `requireLinkedActivity` invariant now validates a chosen Moment even when activity is absent, rejects activity without Moment, and ensures any activity belongs to the selected Moment. Moment-only expense records do not generate nested activity mirrors; unlinking a formerly activity-linked expense removes its existing nested mirror via existing reconciliation. Account/guest backing keys, Firestore collections, legacy backups, stable transaction IDs and event data remain unchanged. Pure Node tests cover scoped options, validation, and child-mirror unlink; manual browser, touch/keyboard/screen-reader and live Firestore tests are still required.

**Premium UX source CI acceptance (2.11.3):** GitHub Actions [run 39662531768](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39662531768) on commit `4dbc5c92e29ad76fddd91884674a82951fb51af6`: **92 Node tests passed, 0 failed**, Vite production `npm run build` **PASS**, mandatory documentation governance **PASS**. The four new regression contracts verify Transactions-only Finance, absence of transaction overflow 3-dot actions, Events 5-action overflow, Activities/Code Lists left trays, compatible financial routes, and unambiguous load-error skeleton suppression. This is **automated source validation**, not manual iOS/Android UX testing, measured 60fps, reliable device haptics, original document/file data recovery, or deployed Firestore Rules verification. Nine npm dependency advisories and a Vite chunk-size warning remain.

**CI validation and loaded-state UX guard (2.11.2):** GitHub Actions run [39661553142](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39661553142) passed 87/87 Node tests, Vite production build and documentation checks for Finance-only navigation / swipe action changes at commit `b64078cf11dc09cb653354e175f6cd6ee61c76fe`. Run [39662186586](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39662186586) passed 88/88 Node tests, Vite production build and documentation checks for unified Activities / Code Lists swipe at commit `97bc91c1fee8392d19462c137aac70f7cc4b2401`. Current Financials source suppresses loading skeletons when a load error is shown, keeping Retry visible instead of showing competing loading and error states. A source-contract regression suite asserts the absence of Finance Overview and 3-dot transaction controls while preserving Events overflow, legacy routes and left action trays. These are source/CI checks only; no real-device frame-rate, native haptics, live Firebase account operations or deployed security-rule test was performed. Nine npm dependency advisories and the existing Vite chunk warning remain open.

**Shared one-way action gesture correction (2.11.1, SOURCE-INSPECTED):** Activity and Code List cards now follow the Transactions left-swipe-to-reveal convention. Activity trays retain Add Transaction, Edit, Cancel/Restore and Delete; Code List trays retain Edit, Activate/Disable where applicable, and Delete. Deletion remains a separate explicit button/callback, and the existing parent confirmation/usage checks are unchanged. Shared horizontal-axis swipe utility returns `other` for deliberate left swipes and `close` for right swipes, never an automatic destructive action; the hook and Code Lists map the close result to dismissed state. Trays use variable widths and glass blur, spring-like CSS transitions, and optional touch-only browser haptics with reduced-motion overrides. JavaScript gesture intent tests cover direction semantics; physical scrolling/frame-rate and screen-reader behavior are unverified.

**Single Finance screen and premium swipe contract (2.11.0; SOURCE-INSPECTED):** Owner removed the Finance Overview view, summary cards and financial tab switcher. The Financials component now always displays the Transactions history/search/type/month/sort controls and Add Transaction action, including at both compatibility URLs `/financials` and `/financials/transactions`. Transaction cards reveal **Edit / Delete** by a left swipe; the transaction three-dot button is removed. The swipe reveals actions only, never executes a destructive mutation, uses a 56px deliberate displacement threshold or a minimum 24px high-velocity left flick, springs to its reveal width, optionally vibrates on supported touch devices, and honors reduced motion. Keyboard focus on a card with Enter/Space reveals the same buttons, Escape closes them; Delete remains confirmation-gated. The Events **three-dot action menu stays** and retains Edit/Duplicate/Share/Archive/Delete. Shared primary/secondary/danger/button hit targets and modal close icon receive additive design-system polish. No income/expense schema, Firestore migration or backup version changes. Real phone/browser render, 60fps measurements, iOS native haptics and calendar behavior are NOT VERIFIED.

**Automated verification of account-scope fixes (2026-10-21):** GitHub Actions [run 39659935648](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39659935648) on application commit `2a4433a6bf2cce1657cf05627bf93199aec7bba9` completed successfully. Node `npm test`: **85 tests passed / 0 failed**. Vite `npm run build`: **PASS** (4.23 seconds reported). Documentation governance and append-only audit: **PASS**. Package installation still reported 9 dependency vulnerabilities (3 moderate, 6 high). This does not verify actual account-switch/browser races, backend Firestore Security Rules, production deployment or real-device UX.

**Scoped financial load isolation (2.10.7, SOURCE-INSPECTED):** Income and expense stores now use a shared `financialLoadScope` guard so that loading account B (or guest) clears cached records belonging to A and invalidates prior `loadedFor` metadata. The current scope is considered cached only if both `activeLoadKey` and `loadedFor` match; returning to a previously in-flight scope reactivates its request before joining it. This closes an account-switch stale-data exposure window in non-Financials consumers, while preserving same-scope optimistic updates. Node regression cases cover both stores' scope-transition helper. Manual account-switch, pending-request and Firestore security testing remain outstanding; no persisted financial data/schema was changed.

**Nested expense metadata contract (2.10.6):** `src/utils/transactionRelations.js:normalizeActivityExpense` now defines the shared event/activity expense projection used during transaction mirror reconciliation and event normalization. It retains transaction `id`, `name`, `category`, `description`, `notes`, `source`, amount, date and parent linkage, with safe defaults for older nested records. A save must not silently strip descriptive financial metadata. No migration or deletion occurs; QA of real guest/cloud round trips is still outstanding.

**Nested-only transaction display contract (2.10.5):** The `useTransactionManager` hook now uses `patchLoadedExpenses` for locally editing/removing a nested-only expense. This updates the already-scoped Zustand projection without resetting its `loadedFor` key. `setExpenses` remains intentionally destructive to scope metadata for full import/restore. This prevents newly created/edited transactions from disappearing behind the Financials "waiting for loaded scope" check, while keeping account isolation. Existing multi-document persistence is not atomic; CI build/tests do not substitute for guest/account browser QA.


**Identity and guest-ledger invariant (2.10.4, SOURCE-INSPECTED):** Account and guest income/expense updates match only actual present IDs; two missing `firestoreId` fields never identify a record. Guest expense writes persist only to the original `dn_guest_expenses` master list, while nested activity expenses remain read-compatible for display/backup. Old duplicated guest rows are preserved for explicit review, not destructively pruned. No Firestore migration, backup format change, or business-record deletion.

### 9.1 Historical transaction notes (source migration stage)
The product-owner-approved financial simplification keeps *two underlying existing Firestore collections* (`users/{uid}/incomes` and `users/{uid}/expenses`) and browser guest keys for data compatibility, while the UI transitions to one Transactions flow. `src/utils/transactionFilters.js` now supplies data-only month options, intersection filters, dynamic income/expense/balance totals, sorting, and normalized form payloads. Existing income normalization now preserves optional linked `eventId`, `activityId`, and notes, with the same note preservation for expenses. **No Firestore migration or record deletion** is needed. Activity-linked expense records may also exist nested within event groups; the UI must avoid deleting/editing their only copy and must reconcile relationships. UI work and cross-collection type transitions require follow-up and browser validation.

### 9.1b Implemented premium-finance and event CI verification (2026-10-21)
The current `OldVersion` source commit `c22b3ddf87afb964e4a72004647306bc6f6d8e05` completed [GitHub Actions run 39656612559](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39656612559) successfully: `npm test` **76 passed / 0 failed**, Vite `npm run build` **PASS**, mandatory master/audit changes **PASS**, four-file Markdown restriction **PASS**. The verified source includes unified Overview/Transactions with one form, activity-linked expense creation, the premium event overflow menu, data-month-only filtering, Code Lists shared swipe thresholds and error-aware activity mirror updates. This is **automated source verification, not a hosted-app or real-device production certification**. Firebase preview remains blocked by absent deployment credentials; live Firestore concurrent-write/failure tests and iOS/Android UI QA remain open. CI installation still reports nine dependency advisories (three moderate, six high) and a Vite bundle-size warning.

### 9.2 DN full-system premium UX audit and release acceptance
**Evidence level:** Source-inspected on OldVersion on 2026-10-21. GitHub Node tests/build verify source compilation and unit behavior, not physical mobile interaction, screenshot quality, 60fps performance, Firebase security or live data recovery.

| Screen / system | Reviewed current implementation | Open verification or design gap |
|---|---|---|
| Dashboard | Existing dashboard summary cards and responsive shell | Measure actual viewport balance, skeletons, empty states and dark/light consistency |
| Events | One event overflow menu for Edit/Duplicate/Share/Archive/Delete, reversible archive filter | Confirm card/menu tap targets, keyboard focus, authentication of shared deep links and no duplicated financial data |
| Activities | Shared swipe hook with axis detection, haptic fallback, unified transaction activity deep link | Validate vertical scroll vs swipe, safe action thresholds and child-expense mirror recovery |
| Financials | Transactions-only with top Income / Expense / Balance totals, unified Moment-first transaction form and left-swipe Edit/Delete | Account/guest create/edit/delete, type conversions, preserving IDs and months after reload, old backup recovery |
| Timeline | Event timeline and activity sorting in existing Event workspace | Check very long histories, native date behavior and event archive awareness |
| Memories / attachments | Notes, keepsakes metadata and memory dialogs | Test keyboard/scroll behavior, original attachment file limitations and empty states |
| Insights | Derived summaries, filters/search and Lucide icons | Cross-check financial totals against unified Transactions for matching periods |
| Settings / Code Lists | Shared DropdownSelect; Code Lists shared gesture controls | Inspect long lists, touch targets, disabling values, focus semantics, mobile keyboard and schema migrations |
| Modals / forms | Shared ModalDialog, DateField (native browser picker), portaled DropdownSelect | iOS/Android viewport, safe areas, reduced-motion, screen readers, validation, 200% zoom |
| Navigation | Desktop and mobile dock, unified financial quick-create | Check bottom navigation occlusion, landscape rotation, keyboard overlap and browser back behavior |

**Design rules adopted for incremental maintenance:** Reuse the existing Lucide family and theme tokens in \`src/design-system.css\`; prefer 44px minimum touch targets; consistent responsive spacing, radii, button hierarchy and focus-visible outlines; destructive actions require confirmation; real transaction amount indicators use theme success/danger colors; overlays use portal placement while native calendar UI belongs to browser/OS; respect prefers-reduced-motion; gestures have an explicit non-swipe action fallback. Optional navigator.vibrate is not a guarantee of iOS haptics. Smooth 60fps is an acceptance target, **not a measured result**.

**Required usability acceptance matrix (NOT RUN in this audit):** 320/375/390/430px phones, 768/1024px tablets, desktop >=1280px; light/dark; keyboard only; VoiceOver/TalkBack; browser zoom to 200%; iOS Safari/Android Chrome; portrait/landscape; visible keyboard; 20+ dropdown values and native calendar interactions; accidental swipe vs page scrolling; guest and logged-in financial create/edit/delete, history filters and backup retry; linked income/expense activity reconciliation; tooltip/overlay clearance above bottom navigation.

**Outstanding production blockers:** Deployed Firestore Security Rules and cross-user tests remain unknown; real account/guest restore-and-migration drills absent; expense/activity cross-collection mutations are non-atomic; automated npm audits reported 9 advisories; no Firebase usability preview URL because deployment credentials are unavailable; no device-level accessibility/performance certification. These stay open until repeatable evidence exists.

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
| **2.15.6** | **2026-10-22** | Scope baseline mobile editor regression test to its own block without counting later targeted 16px fixes | **CHG-20261022-074** |
| **2.15.5** | **2026-10-22** | Completed mobile zoom rule specificity audit for Moment Greeting and compact search fields; corrected obsolete CSS-order test | **CHG-20261022-073** |
| **2.15.4** | **2026-10-22** | Resolved remaining iPhone Safari Greeting Template zoom by overriding high-specificity 14px Moment Type fields at 16px on mobile | **CHG-20261022-072** |
| **2.15.3** | **2026-10-22** | Prevent iPhone Safari form-field auto zoom using mobile 16px editor font floor while preserving pinch zoom | **CHG-20261022-071** |
| **2.15.2** | **2026-10-22** | Align short Finance header test with intended wording and correct actual Transactions panel padding selector | **CHG-20261022-070** |
| **2.15.1** | **2026-10-22** | Flatten Finance summary to three lightweight low-height cards and align CTA/one-line description; align small Moment Memory/Greeting controls beside type text | **CHG-20261022-069** |
| **2.15.0** | **2026-10-22** | Both swipe directions show one compact glass menu with available actions and Delete last; viewport-safe portal replaces card-wide trays | **CHG-20261022-068** |
| **2.14.2** | **2026-10-22** | Protect existing nested Moment/Activity buttons from swipe tray click handling | **CHG-20261022-067** |
| **2.14.1** | **2026-10-22** | Correct stale shared keyboard contract test and align narrow swipe-tray action visibility | **CHG-20261022-066** |
| **2.14.0** | **2026-10-21** | Unified real touch/pointer swipe surface for Moments/Activities/Transactions/Code Lists; fixed Code List extra action row and enlarged Moment header controls | **CHG-20261021-065** |
| **2.13.1** | **2026-10-21** | Kept Finance metrics in one row, repaired Moment and Transaction gesture handlers, changed Code List actions to stationary-card reveal | **CHG-20261021-064** |
| **2.13.0** | **2026-10-21** | Replaced Moments 3dots, standardized left-other/right-Delete and removed List timeline rail without reworking Grid | **CHG-20261021-063** |
| **2.12.2** | **2026-10-21** | Confirmed 99/99 Node tests, production build and governance pass for restored Finance totals, Moment-first linked activity and safe Moment-only card/deletion behavior | **CHG-20261021-062** |
| **2.12.1** | **2026-10-21** | Verified 97-test Finance totals/cascading picker CI and showed Moment-only links on cards; allowed safe delete of Moment-only expenses with removed Moment | **CHG-20261021-061** |
| **2.12.0** | **2026-10-21** | Restored Income/Expense/Balance above Transactions and introduced Moment-first scoped activity selection in unified financial form | **CHG-20261021-060** |
| **2.11.3** | **2026-10-21** | Verified 92/92 tests, production build and governance checks after Finance UI contract and loading error fix | **CHG-20261021-059** |
| **2.11.2** | **2026-10-21** | Verified 87- and 88-test CI suites; prevented stuck financial loading skeleton on error; added source contract regressions for owner-approved Finance/Events swipe behavior | **CHG-20261021-058** |
| **2.11.1** | **2026-10-21** | Standardized Activities/Code Lists left-swipe action trays with safe right-dismissal, kept all existing actions and confirmation | **CHG-20261021-057** |
| **2.11.0** | **2026-10-21** | Removed Finance Overview; implemented transaction swipe-only actions, shared button, modal and motion refinements, audited remaining device/overlay gaps | **CHG-20261021-056** |
| **2.10.8** | **2026-10-21** | Recorded verified 85-test / build / documentation CI pass for scoped financial account-switch isolation; maintained runtime and dependency blockers | **CHG-20261021-055** |
| **2.10.7** | **2026-10-21** | Invalidate stale income/expense projections on account/guest switches and safely rejoin in-flight loads | **CHG-20261021-054** |
| **2.10.6** | **2026-10-21** | Standardized nested activity expense serialization to preserve transaction titles, categories, notes, source and stable IDs | **CHG-20261021-053** |
| **2.10.5** | **2026-10-21** | Preserved scoped financial load state across nested-only expense edit/delete and type conversion | **CHG-20261021-052** |
| **2.10.4** | **2026-10-21** | Corrected missing-ID income/expense matching and stopped guest expense writes from persisting nested-only projection rows | **CHG-20261021-051** |
| **2.10.3** | **2026-10-21** | Recorded verified 76-test/build/governance pass for completed finance and event premium changes; retained live/mobile QA blockers | **CHG-20261021-050** |
| **2.10.2** | **2026-10-21** | Routed event-workspace Link Existing Expense through unified transaction mutation and activity-mirror reconciliation | **CHG-20261021-049** |
| 2.10.1 | 2026-10-21 | Added compensating nested mirror rollback to failed transaction type conversion and same-type linked edits | **CHG-20261021-048** |
| **2.10.0** | **2026-10-21** | Consolidated full DN source-based premium UX findings, design-system standards and device QA acceptance matrix | **CHG-20261021-047** |
| **2.9.11** | **2026-10-21** | Unified Code Lists swipe thresholds/axis locking and haptics with shared activity gesture contract | **CHG-20261021-046** |
| **2.9.10** | **2026-10-21** | Added activity relationship validation preventing orphan transaction links and stale nested expense deletion | **CHG-20261021-045** |
| **2.9.9** | **2026-10-21** | Removed obsolete standalone Income/Expense pages and their eight old display/form components after reference audit | **CHG-20261021-044** |
| 2.9.8 | 2026-10-21 | Restored activity editor access to Code Lists after removing duplicate expense drawer | **CHG-20261021-043** |
| 2.9.7 | 2026-10-21 | Removed activity-level expense-only creation forms and routed all activity financial creation to unified Add Transaction with preserved activity context | **CHG-20261021-042** |
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
