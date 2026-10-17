# Tasks and Progress Tracker

> This is an initial repository audit for the `OldVersion` branch. “Implemented” means the source structure or behavior is present; it does not mean every path has been exhaustively verified in a live browser. Re-check this file as work lands.

## 1. Current snapshot

- **Branch:** `OldVersion`
- **Observed head:** `0db33d3814f822e10cd7fd4a6730a7f511fc632b`
- **Latest commit message:** `Architecture_Approved_Pre_Dexie_Foundation`
- **Stack:** React 18 + Vite 5 + React Router + Zustand + Firebase Auth/Firestore.
- **PWA:** manifest and generated service worker are present.
- **Automated tests:** several Node test files exist; no test script is defined in package.json.
- **CI/lint/type checking:** no scripts/config were identified in the inspected package manifest.

## 2. Implemented foundations

### Product and navigation
- [x] React/Vite single-page application bootstrapping.
- [x] React Router integration and route protection component.
- [x] Shared dashboard layout and page-level modules.
- [x] Dashboard, Events, Expenses, Income, Financials, Insights, Settings, Code Lists, About, and Login pages exist.
- [x] Reusable common components for dates, dropdowns, modal dialogs, loading skeletons, sorting, and connectivity state.

### Authentication and data
- [x] Firebase client initialization for Authentication and Firestore.
- [x] Google provider configured.
- [x] Auth state listener and app session state.
- [x] Guest-mode session persistence in localStorage.
- [x] Guest-to-account merge service exists.
- [x] Domain stores for events, expenses, and income.
- [x] Domain services for events, expenses, and income.
- [x] User-scoped Firestore collection structure is implemented in client services.
- [x] Service-level record normalization.
- [x] Optimistic updates and rollback patterns in event/expense stores.
- [x] Sample-data mode utilities exist.

### Life planning and finances
- [x] Event/moment model includes recurrence, status, greeting-card fields, memories, attachments, and activities.
- [x] Activity model includes completion, priority, dates, and nested expenses.
- [x] Expense records support event/activity associations.
- [x] Expense service reconciles top-level expenses with nested activity expenses and de-duplicates by identifiers.
- [x] Income records and income persistence service.
- [x] Dashboard visibility and greeting-template utility modules.
- [x] Code-list utilities and schema-version migration helpers.

### UX and PWA
- [x] Dark/light theme tokens and root theme application.
- [x] Web manifest and SVG app icon.
- [x] Vite build plugin emits a service worker.
- [x] Shell precaching and navigation fallback.
- [x] Version-aware service-worker update prompt.
- [x] Firebase Hosting SPA rewrite and cache headers.
- [x] Deploy helper script exists.

### Tests currently present
- [x] Event service tests.
- [x] Code-list tests.
- [x] Dashboard visibility tests.
- [x] Greeting utilities/preferences/templates tests.
- [x] Service-worker update decision tests.
- [x] Version-busting test.

## 3. Incomplete or needs verification

- [ ] Verify the current live UI and all major journeys in guest and authenticated modes.
- [ ] Confirm Firebase Security Rules and allowed authentication domains outside this source tree.
- [ ] Verify guest merge is idempotent and safe under partial failures/repeated auth callbacks.
- [ ] Verify Settings export/import/backup coverage and error behavior before treating it as a reliable recovery mechanism.
- [ ] Verify memory/attachment persistence, including whether attachments are references or actual uploaded files.
- [ ] Verify all event recurrence and cancellation/restoration edge cases.
- [ ] Verify service-worker offline behavior on a previously installed PWA and on a fresh install with no network.
- [ ] Confirm cache invalidation works after changes to the worker, manifest, HTML, JS, and CSS.
- [ ] Confirm whether sample/demo mode is accessible in production and whether it can accidentally mask account data.
- [ ] Audit branding inconsistency between LifeHub and DN across manifest, UI, documentation, and worker messages.
- [ ] Review the root `lifehub-insights-2026-10-01.json` and bug evidence documents for outstanding product issues.
- [ ] Review large page/feature components for maintainability and regression risk.
- [ ] Check whether old/duplicate CSS rules are still necessary.

## 4. Recommended backlog

### P0 — correctness and data safety
- [ ] **Security review:** inspect deployed Firestore rules; verify users can only read/write their own documents.
- [ ] **Guest merge resilience:** test interrupted merges, duplicate callbacks, already-merged records, and cleanup timing.
- [ ] **Financial integrity:** add tests for all master/nested expense combinations, duplicate IDs, updates, and deletes.
- [ ] **Storage failures:** handle localStorage quota/unavailable errors for guest writes and preferences.
- [ ] **Destructive action safety:** confirm delete/reset operations have clear confirmation and recoverable failure handling.
- [ ] **Production configuration:** verify Hosting target, Firebase project, analytics behavior, and OAuth domains before deployment.

### P1 — release confidence
- [ ] Add a package script such as `"test": "node --test"` after verifying test discovery and runtime compatibility.
- [ ] Add a repeatable production validation checklist and document expected outputs.
- [ ] Add end-to-end smoke tests for login/guest entry, event CRUD, activity updates, expense/income CRUD, settings, and nested route reloads.
- [ ] Add mobile viewport checks for key forms, event workspace, financial lists, and dialogs in both themes.
- [ ] Test service-worker upgrade from an older installed build to a newer build.
- [ ] Add tests for malformed/legacy localStorage payloads and code-list migrations.
- [ ] Verify direct-route refresh and browser back/forward behavior under Firebase Hosting.

### P2 — maintainability
- [ ] Establish ESLint and formatting tooling, then align existing code incrementally.
- [ ] Consider TypeScript for high-risk data models and service boundaries; do not combine this with a large feature change.
- [ ] Split large pages/workspaces into smaller feature components and hooks.
- [ ] Consolidate design tokens and gradually reduce duplicate/overridden CSS.
- [ ] Document Firestore collections, fields, ownership, migration approach, and backup/restore format.
- [ ] Improve observability without logging sensitive records.
- [ ] Review dependency versions and update policy on a controlled branch.

### P3 — product polish
- [ ] Resolve product naming/branding (LifeHub vs DN) consistently.
- [ ] Audit empty states, loading states, and error feedback across all pages.
- [ ] Check keyboard accessibility, screen-reader labels, focus management, and reduced-motion behavior.
- [ ] Add a manual release checklist for installed PWA behavior and offline shell limitations.

## 5. Test and build commands

Run from the repository root:

```bash
npm ci
npm run dev
npm run build
npm run preview
node --test
```

- `npm ci` installs the lockfile-defined dependencies.
- `npm run dev` starts Vite on the configured host/port.
- `npm run build` creates the production bundle and generated service worker.
- `npm run preview` serves the production build locally.
- `node --test` runs Node test files; verify discovery on the target Node version.
- `npm run deploy:hosting` deploys according to `scripts/deploy-hosting.mjs`; do not run a production deployment as part of routine tests without explicit authorization.

## 6. Definition of done

A task is done only when:
1. The intended behavior is implemented in the correct branch.
2. Guest and authenticated flows are considered, where relevant.
3. Related model/service/store behavior is covered by tests.
4. Existing tests and production build pass.
5. Both themes and mobile layout are checked for UI changes.
6. Errors and failed writes do not silently lose user-visible state.
7. Documentation is updated if product behavior, architecture, setup, or known limitations changed.
8. No unrelated branch or production deployment was changed unintentionally.
