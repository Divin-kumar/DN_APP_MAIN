# Coding Rules and Engineering Standards

These standards are based on the current `OldVersion` source. They distinguish established patterns from recommended constraints for future changes.

## 1. Language and formatting
- Use JavaScript ES modules and JSX unless a deliberate, reviewed migration to TypeScript is approved.
- Follow the repository's existing two-space indentation, single-quoted JavaScript strings, semicolons, and trailing commas in multiline structures.
- Use `camelCase` for variables/functions, `PascalCase` for React components/context providers, and `UPPER_SNAKE_CASE` for module-level constants where appropriate.
- React component files use descriptive PascalCase names such as `EventForm.jsx`; services, stores, hooks, and utilities generally use descriptive camelCase filenames.
- Keep imports at the top of the file. Group React/library imports before local modules; follow nearby files rather than introducing arbitrary sorting rules.
- No formatter or linter script/config was identified in `package.json`; do not claim automated style enforcement. Keep changes consistent with adjacent code.

## 2. React components
- Use function components and hooks.
- Keep route/page composition in `src/pages` and `src/features`; reusable generic controls belong in `src/components/common`.
- Keep domain-specific controls near their domain (events, expenses, income).
- Keep components focused. Extract a child component or hook when a file combines unrelated data loading, business rules, and complex layout.
- Use stable keys for rendered lists.
- Avoid direct DOM manipulation except for deliberate app-shell concerns such as document theme and service-worker integration.
- Do not call hooks conditionally or inside loops/callbacks.
- Preserve semantic HTML and accessible labels, focus states, and keyboard interactions.

## 3. State management
- Use the existing Zustand stores for shared application/domain state; avoid introducing a second global state library without an architectural decision.
- Keep session/preferences/toast concerns in `useAppStore`; domain records belong in their domain store.
- Components should call store actions rather than directly writing to Firestore.
- Keep async state explicit: loading, error, and loaded/session identity as appropriate.
- Prevent duplicate concurrent loads when a store already uses a pending-load map.
- When using optimistic updates, capture the previous record/list and restore it on failure.
- Do not swallow persistence failures while leaving the UI showing a successful mutation. Show a user-safe error and rethrow when callers need to react.

## 4. Services and data normalization
- Services are the boundary for Firestore/local guest persistence and record normalization.
- Normalize external/stored values before exposing them to the UI.
- Use numeric conversion for monetary amounts and consistent date/default behavior.
- Generate stable IDs once when creating a record; do not regenerate IDs for every render or every update.
- Preserve Firestore document identity separately as `firestoreId` when needed.
- Keep guest and authenticated paths behaviorally aligned where the feature is supported.
- Use user-scoped Firestore paths: `users/{uid}/{collection}`.
- Do not embed Firestore calls inside presentation components.
- Do not invent collection names or change a collection path without a migration plan.

## 5. Cross-domain integrity
- Event activities are embedded in event documents. Preserve their IDs and event links.
- Activity-linked expenses may also appear in a top-level expense collection. Update reconciliation/de-duplication whenever the model changes.
- Do not sum both master and nested representations without deduplication.
- Keep delete/update semantics explicit for nested-only financial records.
- Guest-to-account migration must be safe to retry; do not clear guest data before writes are confirmed or otherwise safely recoverable.
- Expose a user-visible migration outcome and a safe retry/recovery path when guest-data migration fails; logging alone is insufficient. `AuthContext.jsx` does not currently provide this visible flow, so track it as a known gap until implemented.
- Code-list migrations must preserve user-defined values and values referenced by existing records where existing helper logic requires it.

## 6. Error handling and logging
- Catch failures at asynchronous persistence boundaries.
- Log technical context with `console.error` for failed operations; use `console.warn` for recoverable infrastructure issues and `console.info` for optional integrations.
- Do not expose raw Firebase/internal exception messages directly to end users.
- Set a stable, understandable store error message and restore optimistic state when a write fails.
- Malformed localStorage JSON should not crash app startup; follow existing safe-load patterns.
- Avoid empty catch blocks unless the fallback behavior is intentional and documented.
- Never log authentication tokens, private user data, secrets, or full sensitive records.

## 7. Firebase and security
- Client-side Firebase config is for the public web client only. Never include service-account keys or privileged credentials in the browser bundle.
- Treat route guards as UX controls, not security enforcement.
- Ensure Firestore Security Rules independently validate ownership and allowed operations.
- Keep user records beneath the authenticated UID and never trust a UID supplied by arbitrary UI input.
- Validate authorization behavior in Firebase configuration/console because security rules were not found in the inspected repository tree.
- Analytics must remain optional and must not block startup or core app features.

## 8. localStorage and guest mode
- Use existing key names unless a migration is included; known keys include `lifehub_preferences`, `lifehub_theme_choice`, `lifehub_guest_mode`, `lifehub_guest_eventGroups`, `lifehub_guest_expenses`, and `lifehub_guest_incomes`.
- Parse stored JSON defensively and merge preferences with defaults.
- Keep guest mode explicit; do not mix guest records into authenticated state without the merge service.
- Consider quota errors and unavailable storage environments for new writes.
- Do not store secrets or treat localStorage as encrypted storage.

## 9. Styling and design system
- Prefer existing CSS variables and shared component classes over new one-off hardcoded colors.
- Review both `src/index.css` and `src/design-system.css`; the latter is imported after the former in `main.jsx`, so its rules can override earlier declarations.
- Test both `data-theme="dark"` and `data-theme="light"`.
- Avoid broad selectors or `!important` unless needed to override legacy styles; document why and scope them narrowly.
- Check responsive mobile layouts, touch target size, keyboard focus, overflow, dialogs, and form control sizing.
- Do not add a new styling framework without approval; the current app uses CSS, not Tailwind.

## 10. PWA and caching
- Keep worker generation in `vite.config.js` unless a deliberate PWA architecture change is made.
- Any change to precached assets, worker cache names, update messaging, or app versioning must be tested against an already-installed app.
- Maintain no-cache behavior for `index.html`, `sw.js`, and manifest unless intentionally changed.
- Do not claim full offline data synchronization based solely on service-worker asset caching.
- Never make update activation silently discard a user's in-progress work; retain the current explicit refresh prompt unless the product requirement changes.

## 11. Tests and quality gates
- Existing tests use Node's built-in test APIs in `*.test.mjs`.
- Run tests using `node --test` (or the explicit targeted test file) because no `test` script is declared in `package.json`.
- Run `npm run build` for every change that affects runtime code or imports.
- Add pure unit tests for normalization, date/status logic, code-list migrations, deduplication, visibility rules, and update-version decisions.
- Test guest mode and authenticated mode independently; mock or isolate Firebase dependencies for unit tests.
- Include regression coverage for rollback after failed writes, duplicate guest merges, and nested expense counting.
- No lint/type-check gate is configured; do not imply these checks have run unless separately installed and executed.

## 12. Do-not rules
- Do not modify `main` or other branches when assigned to `OldVersion`.
- Do not rewrite the Firestore data model without migration/backward-compatibility analysis.
- Do not remove existing localStorage keys or change their schema without a migration.
- Do not count nested and master expenses twice.
- Do not convert all persistence to local-only or cloud-only without explicit product approval.
- Do not add dependencies for functionality already available in the stack without explaining the trade-off.
- Do not hardcode private credentials, assume Firebase rules are secure without inspection, or expose raw backend errors.
- Do not make broad CSS overrides without checking cascade, themes, and mobile layout.
- Do not describe features as completed when only a model field or UI placeholder exists.
