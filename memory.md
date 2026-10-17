# Project Memory and Long-Term Context

This file records stable engineering context for future work on the `OldVersion` branch. It is not a substitute for checking the current code before making changes.

## 1. Current status

- Repository: `Divin-kumar/DN_APP_MAIN`
- Active requested branch: `OldVersion`
- **Application-source audit baseline:** `0db33d3814f822e10cd7fd4a6730a7f511fc632b` (`Architecture_Approved_Pre_Dexie_Foundation`, 2026-10-04T11:29:15Z), the code state inspected before this documentation set was added.
- **Initial documentation verification checkpoint:** `9b711b807276aa24c5e8bfdad858e054b416115c` (`docs(OldVersion): capture long-term project context`). This is historical, not the current branch head; check GitHub before relying on a current SHA.
- Product: LifeHub, a personal life-planning and finance PWA.
- Runtime: React 18 + Vite 5, React Router, Zustand, Firebase Auth/Firestore.
- Deployment: Firebase Hosting site `dn-10`; output directory `dist`.
- Build/test maturity: build and dev scripts exist; test files exist but no test script, lint script, or type-check script is declared in package.json.

## 2. Product context

The app brings life moments, activities, memories/attachments, income, expenses, preferences, and insights into one personal workspace. It supports authenticated Firebase accounts and a local guest mode. Although the current branch is named OldVersion and its latest commit references an approved architecture foundation, inspect actual code and recent branch history before assuming any planned storage migration has been implemented.

## 3. Key technical decisions

### React SPA
- Vite builds a static client-rendered application.
- React Router handles in-app and nested routes.
- Firebase Hosting rewrites application paths to `index.html`.

### Zustand state
- Shared session/preferences/toast state is in `useAppStore`.
- Event, expense, income, and dashboard concerns have dedicated stores.
- Store actions coordinate async persistence and UI-facing loading/error state.

### Firebase
- Firebase Authentication uses Google sign-in.
- Firestore stores authenticated data under a UID-owned hierarchy.
- Current client service paths include:
  - `users/{uid}/eventGroups`
  - `users/{uid}/expenses`
  - `users/{uid}/incomes`
- Analytics is optional and loaded dynamically in production.

### Guest mode
- Guest session and guest records use localStorage.
- Guest data can be merged into an authenticated account by `guestMergeService.js` using a Firestore batch; guest keys are removed after the batch commit completes.
- **Known recovery gap:** `AuthContext.jsx` logs a merge failure but sets the signed-in user in `.finally()` regardless. No visible retry/failure UI is wired in that path, so the app's signed-in state alone does not prove that guest data was migrated.
- This dual persistence model increases complexity and requires explicit testing of idempotency, concurrent/repeated auth callbacks, cleanup, and partial failures.

### Embedded activity model and expenses
- Activities are embedded in event documents, not a separate collection in the inspected service.
- Activity expenses can be embedded within those activities while financial reports also read top-level expenses.
- Expense normalization/reconciliation merges both sources and de-duplicates by IDs/document identity. Preserve this behavior when editing financial logic.

### PWA
- The manifest declares standalone display and portrait orientation.
- Vite emits a custom `sw.js` with versioned Cache Storage.
- A waiting worker can be activated after a user-visible refresh prompt.
- Offline support primarily covers the application shell/assets. Do not assume all Firestore-backed data is available offline or that offline writes synchronize automatically.

## 4. Important localStorage keys

Observed keys include:
- `lifehub_preferences` — user preferences JSON.
- `lifehub_theme_choice` — marker indicating an explicit theme choice.
- `lifehub_guest_mode` — guest session choice.
- `lifehub_guest_eventGroups` — guest events and embedded event data.
- `lifehub_session_backup` — backup copy written by event guest normalization.
- `lifehub_guest_expenses` — guest top-level expenses.
- `lifehub_guest_incomes` — guest incomes.
- Admin/code-list keys are defined in `src/store/useAppStore.js`; read that file before changing their names or schema.

Do not rename/remove keys without a migration. localStorage can be cleared or unavailable, and is not suitable for secrets.

## 5. Environment and setup

### Requirements
- Node.js version compatible with Vite 5 and the installed Firebase SDK.
- npm.
- Access to the Firebase project and appropriate permissions for authenticated testing/deployment.

### Local development
```bash
npm ci
npm run dev
```

Vite is configured with host `0.0.0.0` and port `5173`. The preview server uses port `4173`.

### Build and test
```bash
npm run build
npm run preview
node --test
```

The package currently defines `dev`, `build`, `preview`, and `deploy:hosting`; no npm test/lint/type-check script is defined. Run `node --test` directly and confirm tests are discovered under the Node version used.

### Deployment
- Firebase Hosting config points to `dist` and site `dn-10`.
- The deployment helper is `scripts/deploy-hosting.mjs`.
- Inspect the script and current Firebase target before deploying; do not deploy to production without explicit authorization.
- Keep SPA rewrites and no-cache headers for HTML/service-worker/manifest in mind when changing hosting config.

## 6. Configuration and secrets
- Firebase client configuration is in `src/firebase/config.js`. These client identifiers are included in browser builds by design; they are not a substitute for Firebase Security Rules.
- Do not add service-account JSON, private API keys, credentials, or tokens to source.
- No `.env.example` or required environment-variable list was confirmed during this branch inspection. Vite config reads optional values such as `VITE_DEPLOYED_AT` and `VITE_DEPLOY_ENV`; app version is derived from package version and injected at build time.
- Verify OAuth authorized domains and Firestore Security Rules in Firebase project settings; they were not found in the inspected root tree.

## 7. Known quirks and technical debt

1. **Brand mismatch:** documentation and many CSS selectors say LifeHub, while the manifest/app update copy includes DN branding.
2. **CSS overlap:** `src/index.css` and `src/design-system.css` both define tokens and broad component styling. The second stylesheet is imported later and can override earlier rules.
3. **Large source files:** `Events.jsx`, `EventWorkspaceShell.jsx`, `DashboardOverview.jsx`, `DashboardLayout.jsx`, and the CSS files are substantial; make narrow changes and test regressions.
4. **Multiple persistence modes:** Firestore, guest localStorage, and sample-data mode coexist. Determine which mode is active before diagnosing data behavior.
5. **Guest merge risk:** auth callbacks may repeat and a merge may partially fail. Preserve retry safety and avoid destructive cleanup before confirmed writes.
6. **Nested financial records:** expense reports combine master expenses and activity-nested expenses; incorrect deduplication can overstate totals or lose records.
7. **No server API:** business logic/persistence mostly executes in the client through Firebase SDK. Do not assume there is a backend server to host new endpoints.
8. **PWA cache behavior:** stale worker/assets can make a deployment appear unchanged. Test version bump, update prompt, and activation in an installed PWA.
9. **Test tooling gap:** test files exist, but package scripts do not expose a standard test command and no lint/type-check configuration was identified.
10. **External security config:** Firestore Security Rules are not in the inspected tree; authorization must be verified in Firebase configuration, not inferred from client code.

## 8. Branch safety and workflow

- Make changes only on `OldVersion` when this branch is the assigned target.
- Do not modify `main`, `Post_V2_Cancel`, or `lifehub-latest` unless explicitly requested.
- Before editing, inspect the current branch head and relevant files; avoid assumptions based solely on documentation.
- Prefer small, reviewable commits and do not perform production deployment unless asked.
- When changing schemas, localStorage formats, Firestore collections, or PWA cache strategy, document migration/rollback implications first.

## 9. Documentation maintenance

The six root files are the working documentation system:
- `prd.md`: product behavior and requirements.
- `architecture.md`: runtime, data model, service boundaries, deployment.
- `rules.md`: engineering conventions and guardrails.
- `design.md`: visual tokens, layout, interaction, accessibility.
- `tasks.md`: verified implementation and prioritized backlog.
- `memory.md`: durable context and operational quirks.

Update the relevant file when a meaningful behavior or architectural decision changes. Keep observed facts separate from recommendations and verify status claims against code/tests.

## 10. Session log and operating agreements

### 2026-10-17 — automatic documentation maintenance

- **Task tracking:** after each completed feature, bug fix, or executed task, update `tasks.md`; check off only work whose completion is verified and add follow-up tasks discovered during implementation or review.
- **Durable memory:** record new technical choices, workarounds, environment/configuration changes, and architecture decisions in `memory.md` during the same work session.
- **Editing workflow:** repository file-writing access is available through the connected GitHub tools, so update the files directly on the requested branch rather than returning replacement Markdown for manual copying. Re-read the changed files after writes.
- **Verification discipline:** distinguish changes made from checks actually run. Never claim tests, builds, browser/device validation, deployments, or security checks succeeded unless executed and verified.
- **Branch safety:** for this work, the target is `OldVersion`; do not change `main` or other branches unless the user explicitly changes the target.

### 2026-10-17 — follow-up documentation audit

- Re-read `prd.md`, `architecture.md`, `rules.md`, `design.md`, `tasks.md`, and this file on `OldVersion`, and cross-checked documented repository paths against the branch tree. No missing source paths were found in the sampled path references.
- Corrected documentation to treat `0db33d3814f822e10cd7fd4a6730a7f511fc632b` as the **application-source audit baseline**, and `9b711b807276aa24c5e8bfdad858e054b416115c` as a **historical documentation checkpoint**—neither should be assumed to be the live branch head.
- Confirmed the key guest-merge quirk in the docs: merge failures are logged, but the auth listener still finalizes signed-in state; the inspected flow has no visible failure/retry prompt. Follow-up work must design a safe, idempotent retry/recovery flow and avoid implying migration success when it failed.
- Added a session work log to `tasks.md` with verified documentation work marked complete and runtime validation/guest-merge recovery retained as open follow-ups.
- No new runtime dependencies, environment variables, components, source directories, or architectural changes were introduced in this documentation-only session. `architecture.md` and `rules.md` were adjusted only to accurately describe the existing behavior and its safety requirement.
- Verification performed: re-read changed files and checked the GitHub branch/tree/compare metadata. Tests, production build, browser journeys, deployed Firebase rules, and deployment were **not** run as part of this documentation pass.


### 2026-10-17 — complete backup export
- Replaced the Settings backup's three-key allowlist with a versioned JSON export of all `lifehub_*` localStorage entries plus effective eventGroups, expenses, and incomes.
- Signed-in exports fetch the user's Firestore-backed records through existing service functions; guest exports use guest-local service readers; active development sample data is exported from its isolated fixture source.
- Event-group export includes data embedded in event documents (activities, memories, attachments, and greeting-card data). Expense service output is deduplicated against nested activity expenses for reporting/export.
- The export includes account identity metadata (UID/display name/email only), not authentication credentials or Firebase security rules.
- Backup format version 2 separates `data.localStorage` from `data.collections`. Restore remains backward-compatible with the previous flat backup shape; v2 restore applies local settings only and intentionally does not write cloud records into Firestore. Full cloud import remains an explicit follow-up to avoid accidental overwrites/duplicates.
- No dependencies or environment variables added. GitHub source edits only; automated tests, build, and live Firebase/browser validation have not yet been run.
