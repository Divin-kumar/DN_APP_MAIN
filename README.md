# DN

Development branch: `OldVersion` in `Divin-kumar/DN_APP_MAIN`.

Approved changes are committed to `OldVersion` and tracked as one deferred Firebase-release batch. **Owner review and manual verification are Firebase-only; Vercel is not a testing requirement.** Publishing to Firebase and changing the version remain separately authorized actions; see [agent rules](AGENTS.md).

- [DN business guide](docs/DN_BUSINESS_GUIDE.md) — plain-language app overview, current features, limits and future improvement checklist.
- [Master source of truth](docs/MASTER_SOURCE_OF_TRUTH.md) — current behavior, architecture, data and limits.
- [Agent rules](AGENTS.md) — authorization, development and documentation workflow.
- [Change log](docs/CHANGE_AUDIT_LOG.md) — latest changes first; verification and release history.

## DN 2.1 version reconciliation (30 October 2026)

The permanent Firebase app is **owner-reported v2.0.5**; the checked-in `OldVersion` review source is **v2.0.3**. The current Vercel review represents newer, as-yet-unreleased changes on that branch, not an assertion of production code parity. The legacy `npm run deploy:hosting` increments the source patch version before each manual Firebase deployment: from committed v2.0.3 it would produce v2.0.4, **older than the reported live version**. Its fail-closed live-version guard now rejects that proposed downgrade **before modifying files or deploying**. The opt-in Firebase production workflow applies the same check to the committed version. Both require a publicly readable live service worker and a strictly newer candidate; neither authorizes or triggers publication. See `node scripts/check-hosting-release-version.mjs` and the semantic-version tests. Do not change `main` or publish Firebase to resolve the label mismatch.

The read-only comparison script `node scripts/audit-live-builds.mjs` inspects public `index.html` and `sw.js` for Firebase and the `OldVersion` Vercel preview and prints versions, shell build IDs and entry asset identity. The OldVersion CI workflow also reports those findings without deploying or accessing Guest/account data. A mismatch (or failed fetch) is an **unverified source parity gate**, not permission to overwrite live. See [master](docs/MASTER_SOURCE_OF_TRUTH.md) and [CHG-20261030-163](docs/CHANGE_AUDIT_LOG.md).

## Pending Firebase batch (30 October 2026)

The owner finished an initial Firebase iPhone visual pass, found no major issues and requested **one later combined deployment**, not incremental publication. Track CHG-213 (discovery empty states), CHG-214 (Settings-owned filter/sort defaults), CHG-215 (direct List defaults access and reset warning), CHG-216 (readable compact filter rules on small iPhones), CHG-217 (backup of saved List defaults), CHG-218 (priority-label test selectors and confirmed CHG-216 preview), CHG-219 (owner iPhone checkpoint and safe Settings reset), CHG-220 (filter-independent overall Activity completion), CHG-221 (calendar-safe monthly and leap-day Moment recurrence), CHG-222 (preserve optional Dashboard shortcuts in old backup restores), CHG-223 (active account and Guest-sample isolation of Transactions), plus subsequent approved OldVersion work, in the master source of truth and change log. Those updates are source-only pending release; do not bump the app version, upload to Firebase, alter `main`, or assume a Vercel build exists. Confirm the actual last-live source and version, run full CI against the candidate SHA, and obtain separate owner release authorization before the batch upload.

Settings → List defaults opens the saved browser-local filter/sort baseline directly (the existing Code Lists → Sorting & filters section), without a long scroll. These defaults do not mirror the live list. Moments, Activities and Transactions use those defaults on a new list and restore them when their Refine Reset is selected. Existing working filters remain until Reset. Nested Moment list filters are not overridden. New v3 application backups also include each domain's saved baseline; older backups lacking it leave current Settings baselines untouched, and importing never replaces active page filters.

### Owner iPhone test checkpoint

On 31 October 2026 the owner marked all 16 manual checklist items Checked on the READY `a769030c` preview. No defects were reported in that response. It is an acceptance checkpoint for the UI and filter behavior through CHG-216 only, not an automated pass, CHG-217 backup test or authorization to publish Firebase. CHG-219 adds fail-closed protection to actual Reset all settings: verify all three record stores belong to the initiating Guest/account and demo context before changing referenced Code Lists and decline applying preferences to a different session after an asynchronous write.

### Transactions stay scoped during account and Guest demo changes

CHG-223 makes the Finance screen wait until **both** Income and Expense stores belong to the current account or current isolated Guest sample before showing cards and the compact Income/Expense/Balance totals. During a sample/account switch, the existing loading skeleton replaces stale values and any existing edit/delete draft is discarded. The source is queued for Firebase-only owner verification, **not yet deployed**. New unit and iPhone synthetic browser tests were authored but not executed.

### Safe restore of Dashboard shortcuts from older backups

CHG-222 distinguishes omitted Dashboard Favorites and Recently Opened settings from explicit empty lists. Restoring a v1/v2/older v3 file without those fields **preserves existing shortcuts** instead of clearing them; an explicit empty list still clears only the included field. When present, shortcut IDs are schema-validated before records import, deduplicated and restricted to valid restored/current Moments. This is part of the deferred Firebase-only batch, not a published fix. New unit and iPhone browser scenarios are authored but not yet executed.

### Recurring Moment date consistency

Monthly Moments dated on the 29th, 30th or 31st repeat on a short month's **last valid day**, then return to their original day in longer months. February-29 yearly anniversaries show February-28 in non-leap years and February-29 in leap years. Dashboard upcoming dates and the Activity-to-Moment picker use the same implementation. No original record date or optional saved time is rewritten. CHG-221 is **pending Firebase publication and iPhone QA**, along with the earlier held changes.

### Firebase-only manual QA boundary

The owner now relies on the permanent Firebase app for all future manual testing. The historical 16-item acceptance checkpoint on commit `a769030c` is retained, but new CHG-217–220 changes are not currently published to Firebase and are **not** approved by that checkpoint. No Vercel build or preview is needed to continue development. Exact-SHA unit, lint, build, E2E, offline, backup and upgrade checks must be run before an authorized Firebase batch release. CHG-220 keeps the overall Activities progress fraction based on all active Activities across Moments even when search or Refine shows only a subset of cards. The three newer filter-related browser tests use the actual default `High priority` Code List label.

## Run locally

Use the current Node.js 22 release (22.12 or newer) and npm. The package, Vercel runtime selection and all CI workflows use Node 22; the dependency follow-up was verified locally on 22.23.4. Install locked dependencies:

```sh
npm ci
npm run dev
npm run lint
npm audit --audit-level=moderate
npm test
npm run check:docs
npm run build
npm run preview
```

Dev uses port 5173; preview uses 4173 and requires a successful build. Both bind `0.0.0.0`.

`npm run deploy:hosting` is the legacy manual authenticated release command: it increments package/lock patch versions, builds and publishes Hosting. The opt-in GitHub **production** workflow targets the permanent `dn-10` Firebase Hosting site only when an `OldVersion` push commit title/message contains `[deploy-live]`, or when authorized manually through `workflow_dispatch`. It runs unit, lint and Chromium tests and a production build before uploading. Publication requires an appropriately scoped GitHub Actions repository secret named `FIREBASE_SERVICE_ACCOUNT` (service account JSON for `expense-tracker-divin`); the job fails before upload if it is absent. Never commit or paste the private credential. After upload it checks live index bytes against the exact build. For previews, use the existing `[deploy-preview]` workflow, which never publishes the permanent site. Firebase configuration and hosting details are in the [master](docs/MASTER_SOURCE_OF_TRUTH.md#architecture-overview).

Browser regressions use synthetic records and do not require signing in or writing to Firebase:

```sh
npx playwright install chromium
npm run test:e2e
npm run build
npm run test:production
```

Set the optional DN_TEST_PORT environment variable to use an isolated browser-test port (default 4175). Test output and the browser test server’s separate dependency cache go to ignored `.verification/`. For isolated runtimes, add `--host 127.0.0.1` when starting Vite. Published **1.0.35** provides a smaller filter panel that automatically remembers the last active filters, shorter comparison menus, dropdowns that wait for explicit search focus, and a minimal Dashboard greeting with date controls beside each section heading. All 63 served files and seven SPA routes matched the final tested production build. See the [change log](docs/CHANGE_AUDIT_LOG.md) for release evidence.

Filters show active Code List choices alongside historical values from the current account/Guest records. Settings → Code Lists → Payment Methods manages transaction payment choices; the same methods appear in forms and both transaction filters. Income, Expense and Balance follow exactly the matching rows, including search and the complete filter expression. Code Lists manages choices for supported fields; it does not create arbitrary new fields. Record IDs and stored metadata are not exposed. Configuration conditions stack one below another, with field, comparison, value and remove controls on each row. Applied filters sit side by side in one horizontally swipeable strip as lightweight borderless controls. Tap an applied filter to change its existing value, or use its separate × button to remove it. Long displayed labels may be shortened; their full values remain in the editor and storage. App-owned scroll areas hide scrollbar chrome while retaining wheel, touch and keyboard scrolling. Active filters, sort and cover choice/position/zoom remain scoped browser preferences; original files are unchanged. The Dashboard greeting shows the user’s name and date on all screens, without summary metrics or greeting-triggered finance loads. Activity list cards stay menu-free, show the Moment name clearly as plain text and retain opening-source-aware detail paging. Code Lists now owns both sorting and on-demand filters for the three overall lists; the redundant Settings sorting shortcut is removed. All new originals stay in scoped browser IndexedDB; contextual transactions and Moment Activity cards remain read-only. Transaction creation uses universal +; edit forms provide a choices-first Linked Moment/Activity picker and open search only when requested, with no implicit nested-label focus. Dashboard and Moment actions open the same PDF Studio page, with actual multi-page previews and downloads using available originals; PDF pages are image-rendered, not selectable text or a recovery backup. See the master for routes, source precedence and scope rules. No business-record migration or backup-format update is required. Moment type Dashboard choices use the existing Code List settings.

The production-shell check serves the built `dist` locally, verifies service-worker activation, then tests offline Story, exact-byte original download and PDF export using isolated Guest fixtures. Its screenshots/results go to ignored `.verification/production-shell`. It does not publish Firebase or test a physical installed PWA.

DN 2.0 Phase 8 on OldVersion completes the Story / Activities / Transactions / Gallery / PDF Studio destinations, with legacy links retained, Notifications marked Coming Soon and obsolete Summary/HTML/Word workspace code removed. The owner reports the DN 2.0 deployment completed; current 2.0.2 prepares the optional Activity time update for Vercel review. Insights improvements remain deferred. See the master and latest change-log entry for regression evidence and remaining validation limits.

The Phase 8 dependency follow-up uses React Router 7.18.5, Vite 7.3.7 and React plugin 5.2.0. Firebase stays on SDK 12.19.0; a scoped npm override selects patched gRPC 1.14.6 for its Firestore Node dependency. The previous JavaScript compilation targets are explicit in vite.config.js. CI checks dependency advisories and the built offline shell before any opt-in Firebase upload. That maintenance did not publish Firebase; Phase 9 version preparation is described below.

The 2.0.2 CI follow-up additionally pins Firestore's transitive RE2JS to patched 2.8.7 through a scoped override. Firebase stays at 12.19.0, Node stays at 22, and dependency auditing remains enabled.

## DN 2.0 release history

The owner reports manual publication after the earlier credential-blocked 2.0.0 workflow. The live worker was observed at 2.0.1 on 29 October 2026; no complete source/build comparison for that manual release is claimed. Current source 2.0.3 preserves the owner’s version commit and prepares Vercel review for configurable payment methods, shared Code List filter choices and matching transaction totals, retaining optional Activity times introduced in 2.0.2. Create/edit/clear, clock-aware Story/PDF/list order, Activity Time filters and backup-v3 preservation are documented in the master. Firebase publication of this update remains a later owner-approved step.

To reproduce the pre-release upgrade check, use Node 22 and the current locked dependencies:

```sh
mkdir -p .verification/phase9/previous
git archive dfe40bbc90b0a740cf2dd44132d72997634f12c7 | tar -x -C .verification/phase9/previous
ln -s ../../../node_modules .verification/phase9/previous/node_modules
npm --prefix .verification/phase9/previous run build
npm run build
npm run test:upgrade
```

Use an empty fixture directory for those setup commands. Alternatively, point DN_UPGRADE_PREVIOUS_DIST at an existing baseline dist and set DN_UPGRADE_PREVIOUS_VERSION to its version. Normal CI rebuilds the pinned previous OldVersion fixture automatically. Results/screenshots stay in ignored .verification/release-upgrade. The check serves two local builds in an isolated browser profile and does not deploy or sign in to Firebase.

Use the version-preserving production workflow or a separately authorized authenticated local Hosting deployment to publish a prepared version. The legacy deploy:hosting command increments the patch first, so it would change the current 2.0.2 source to 2.0.3. Keep main frozen; verify the latest OldVersion source, build before deploying, and distinguish publication from live verification. New updates retain Vercel review followed by separate Firebase approval.

Optional local clock times are available beside every editable Moment, Activity and Transaction date, using the same Activity form layout and Clear time control. Date filters include the whole day, with saved clocks ordering same-day date-sorted results; explicit Time conditions narrow that cohort. Untimed records stay untimed, and backup v3 retains clocks. This is an OldVersion/Vercel review update, without a version bump or Firebase publication.

New Moment, Activity and Transaction forms prefill the current local time when opened. The draft clock stays fixed while typing, can be changed or cleared, and refreshes on a newly opened form. Editing an existing untimed record keeps it untimed.
