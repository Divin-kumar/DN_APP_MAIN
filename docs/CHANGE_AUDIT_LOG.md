# DN — Change Log

**Policy:** Record meaningful changes below this introduction, latest first by descending CHG date and sequence. Preserve historical entry text; record corrections in a new entry. A new entry is not required for every push or ordinary documentation maintenance. Earlier mandatory-per-push and append-at-bottom instructions inside historical records are superseded by the owner's 2026-10-22 direction. The [master](MASTER_SOURCE_OF_TRUTH.md) defines current behavior; [AGENTS.md](../AGENTS.md) defines maintenance rules.

**Historical coverage limitation:** Earlier repository history has not been fully reconstructed. Existing records are preserved evidence and may describe superseded behavior or policies.

## CHG-20261027-109 | Expand the Dashboard welcome with responsive time-of-day emoji (OldVersion source)
- Owner approved the previously reviewed four-line premium welcome: simple “Your day” eyebrow, larger “Good morning/afternoon/evening, [first name]”, complete local date and the exact two supporting lines “A fresh day, a few good moments ahead.” and “Your plans and memories are right here.” Emojis pair ☀️ with morning (00:00–11:59), 🌤️ with afternoon (12:00–17:59), and 🌙 with evening (18:00–23:59). Local clock already refreshed every minute and on window focus/visibility; the card reuses that instead of starting extra timers or reading business data.
- The existing small one-row greeting is replaced by a full-width, responsive, softly tinted card with restrained eyebrow, typographic hierarchy, theme tokens, rounded corners, comfortable spacing, and an unclipped long-name fallback. The full date is now visible on mobile, instead of being hidden under 480px. Existing Upcoming/On This Day panels, visibility choices, activity navigation, finance calculations, records and service boundaries remain unchanged.
- Updated greeting unit tests to verify the name, content, date, no-business-read boundary and time-period emoji transitions; updated Dashboard browser geometry expectations and added a 320px clock-change journey covering 11:59→12:00, 18:00 and the next midnight without a reload. Source/master and owner-facing guide are aligned. No version bump, backup-format change, Firebase data change or main-branch write.
- **Validation boundary at authoring:** Source-derived review completed; full GitHub CI, live signed-in paths, real phone keyboards and final production build are not yet verified. Published Hosting stays v1.0.35 until a separately verified deployment. Previous filter rail checks passed in OldVersion CI run 40472634122.

## CHG-20261027-108 | Append-only audit stabilization for the filter rail changes
- The filter rail and active-chip changes remain exclusively on OldVersion. The initial incremental chip commit had edited the already recorded CHG-106 entry, causing GitHub audit validation to reject that push. The subsequent correction restored CHG-106's exact original text in source but also failed the immediate-parent history comparison because the preceding commit contained the edited entry. This documentation-only entry records those facts without modifying CHG-107, CHG-106 or any older audit text. No history reset or force push was performed.
- **Executed earlier validation:** At source commit 52e7c8a, 405/405 Node tests, lint and 99/100 browser journeys passed; all new horizontal editor tests (320/390/768/1440px) passed. One unrelated Dashboard touch-area assertion observed a 43.999984px subpixel geometry value and its test threshold was made tolerant without changing the dashboard UI. At chip commit 19313db, 100/101 Chromium journeys passed, including the new active-chip scrolling test; the sole failure was an existing synthetic-account Dashboard type-visibility case. Both runs skipped production build after browser failures. Documentation governance failed on altered audit history for the second and third commits. The final source remains at the corrected, unmodified historical CHG-106 text.
- **Pending:** Final full GitHub CI results on the append-only log and revised Dashboard browser threshold. Firebase production and preview publication were not triggered. No business records, IDs, filter semantics, attachment originals, backup schema, or main branch changes were made.

## CHG-20261027-107 | One-line active chips and first CI refinement for horizontal filters (OldVersion source only)
- Continued the owner's horizontal-filter request on existing OldVersion with no branch creation, main write or Firebase deployment. Active removable filter chips had still wrapped below the builder; they now use a single scrollbar-hidden, keyboard-focusable horizontal strip, ellipsized display text and unchanged full accessible removal labels. Added a browser check for eight long active chips at 320px including ArrowRight scrolling, removal and no document overflow. The shared editor rail and its 320/390/768/1440px coverage from CHG-106 remain unchanged.
- The first CHG-106 GitHub run (40471721195) completed 405/405 unit tests, lint and 99/100 Chromium tests; its new four horizontal-rail checks all passed. The only failing browser assertion was unrelated Dashboard 768px hit-target geometry (reported 43.999984px against an exact 44px threshold). Relaxed test-only floating-point comparison to 43.9px; production Dashboard code and visual sizing were not altered. The first run skipped build after the failed browser step. The CHG-107 change also corrects the audit entry update attempted in the second commit, which was rejected because it edited already-recorded CHG-106 history.
- **Validation boundary:** GitHub run 40472073325 failed documentation-contract on preserved history while its application test job was still running when this record was authored; the new dedicated chip regression and final full build require new CI results. No claimed live/site/browser or native phone verification and no Firebase publish. Business identifiers, records, filter evaluation, guest/account separation, storage and backup formats are untouched.

## CHG-20261027-106 | Horizontal condition rail for compact premium filtering (OldVersion source only)
- Owner requested multiple filter conditions remain horizontally arranged rather than stacking and consuming the page height, with unobtrusive sideways access and polished desktop/phone responsiveness. Read OldVersion governance/master, existing shared ConditionBuilder, ListControls, dropdown portal, editor/state semantics and browser suites. Work is restricted to OldVersion; no new branch or main changes.
- Shared condition editors now render in a no-wrap, hidden-scrollbar rail with compact bordered surfaces and a subtle fade at an overflow edge. The persistent Add filter/Clear all footer provides accessible previous/next rail controls only when needed. Touch and trackpad scroll still work, and the rail has keyboard focus. Newly added rules scroll into view; reopening a saved set begins at its first card. Existing comparison/value widgets, saved filters, per-account/Guest scope, nested legacy OR groups, business IDs, calculations and backup format are unchanged.
- Browser regression coverage added for horizontal alignment, sideways overflow, action visibility, previous/next navigation, removal, clearing, no document horizontal overflow and phone/tablet/desktop widths of 320/390/768/1440px.
- **Validation status:** Source-derived: layout and handlers are scoped to the shared condition editor, reused across five filtering contexts. Automated lint/unit/Chromium/build and live-device checks are pending GitHub CI at time of initial entry; do not claim execution until runs are inspected. No live Firebase release requested or performed; production remains 1.0.35. Existing local-original/device/concurrency limitations remain; this is a presentation-only change and no account data is modified by code publication.

## CHG-20261026-105 | Lightweight filters, deliberate search focus and a minimal Dashboard greeting; publish DN 1.0.35
- Owner requested smaller mobile filters with only the last active choices, no saved/recent/favorite presets or Add filter group, simple meaningful comparisons, and no automatic search focus/keyboard. Dashboard should show only a short greeting and place small Upcoming/On This Day controls beside each section heading and Hide button. Reviewed clean OldVersion base `bd1ffee47ae8c27049f6e68e089a216fd0a85c25`; remote freshness matched before writes and publication, with main unchanged at `8989955077f70056300ca5fcf610bb84d42b509b`. Source and published version are 1.0.35.
- The shared filter editor removes preset/save/history/favorite controls, nested-group creation, the logic selector and decorative nested surfaces. Add filter and Clear all share a compact action row; field/comparison/value/remove stay on one phone row. New rules combine with AND; existing nested/OR expressions retain their actual meaning, visible labels and removal, including when another narrowing rule is added. Scoped current-group memory, one-time legacy migration, debounce/draft guards, direct Activity paging and finance date-only totals remain. The hook no longer records history or exposes preset actions. Old preset metadata is ignored rather than activated.
- Comparison menus offer small type-specific sets and omit empty/not-empty or broad set/string operations for new choices; older active comparisons remain identified and removable without silently changing the matching records. Dropdowns show search only when useful for long choice lists. Opening them focuses the nontext trigger; no resize/reposition effect moves focus to search. Explicit tapping or keyboard Tab enters search; arrows, Enter/Escape and typeahead remain. The older Moment chooser search also no longer autofocuses. Mobile filter panels are capped at the smaller of 320px or 42svh and scroll internally when many existing rules are present; portalled dropdowns remain independent.
- Dashboard greeting now contains only the local-time salutation, first name and small date; activity/finance metrics, narrative and related greeting-only finance loads/retry UI are removed. Moments and Activities retain their data, retry, per-type visibility and global Show/Hide behavior. Their small date controls share the heading row next to Hide on phones and larger layouts. About, README, master and business guide describe the same controls within the five-document inventory.
- **Executed validation:** 405/405 Node tests, 96/96 Chromium journeys, ESLint, Production Vite build (2,527 modules; 63 files), five-document inventory/74 local links/history checks and diff review passed. After the final visual-only toggle adjustment, all seven Dashboard journeys passed again with new assertions for the 28px visual pill and 44px button hit areas at 320/390/768/1440px. Mouse/touch browser journeys cover all five filter consumers without any automatic text focus, explicit long-list search and keyboard typeahead/Backspace, retained filters after reload/account switches, no preset/group UI, short comparison sets, legacy OR/date-total meaning and a bounded many-filter panel. Visual inspection at 320/390/1440px found a 174px one-rule panel, compact greeting/header controls, zero page errors and no horizontal overflow. The initial final visual script reached a stopped test server after the full run completed; the focused Dashboard run produced the inspected final screenshots. Build retains the existing mixed Firebase import and large-chunk warnings.
- **Executed publication/read-back:** package/lock bumped once to 1.0.35; authenticated local Firebase CLI published the final Production build to permanent [DN](https://dn-10.web.app). Browser-network read-back with service workers blocked matched **63/63 file hashes and seven SPA routes** at `2026-10-26T09:49:36.410Z`; index SHA-256 `66646cf866df5288b654e42334db445d4b3dcdf5f8373978a1c9e568b8982b87`. Fresh synthetic Guest UI confirmed About v1.0.35/Production, five friendly Moment fields, short Is/Is not comparisons, no automatic input focus, last Moment type Vacation retained after reload, 174px filter panel, greeting-only Dashboard and 28px heading toggles beside Hide, with zero page errors/overflow. Browser verification allowed the runtime proxy certificate; it is byte/UI evidence, not a TLS/security test. No live account business records or production originals were edited. Git publication accompanies this entry only on OldVersion.
- **Source-derived / risks / unverified:** no business-record, ID, finance calculation, attachment/original-file, backup-format, Rules/billing or main-branch change. Scoped filter/sort and section choices remain browser-local; ignored presets are not a recovery feature. Full lists remain in memory and existing concurrency/local-original limitations remain. Chromium focus/viewport evidence cannot certify physical iOS/Android keyboards, native calendars, installed-PWA behavior, screen readers, live signed-in cloud security or cross-device behavior.

## CHG-20261026-104 | Friendly compact filters, sorting, cover zoom and per-type Dashboard Activity visibility; publish DN 1.0.34
- Owner's follow-up requests refine CHG-103: offer relevant human-readable filter choices instead of every stored field, restore explicit sort controls, keep each phone condition on one row, add bounded cover pinch/zoom/reset, and independently hide Dashboard Activities for each Moment type. Reviewed clean OldVersion base `a3a08dd4f5151435abbbc194a01f43807f24d0fe`; remote freshness matched before edits and release. Main remains unchanged at `8989955077f70056300ca5fcf610bb84d42b509b`. Source and published version are 1.0.34.
- All five existing filter surfaces use short product-specific catalogs and named scoped Moment/Activity choices, readable status/priority/type/visibility labels and searchable dropdowns. Stable linked IDs stay internal; new transaction Activity conditions distinguish the parent Moment when child IDs repeat. Legacy saved generic Other, boolean visibility, text comparisons and child-ID choices retain their matching behavior, including mixed old/new multi-selections. Label maps avoid repeated full-record scans for each choice. Older unsupported technical fields display an unavailable-filter label and remain removable; generic discovery is retained only as an internal fallback. Phone field/comparison/value/remove controls share one row, including side-by-side range boundaries, without expanding the page horizontally. Saved/recent/favorite filters and scope/draft guards remain.
- Moments default to Event date oldest first, with explicit Event date/name/status sorting and direction; global and Moment Transactions offer Date/Amount/Title and direction with newest first as default. Sort choices persist in their existing scoped browser list state; reset restores defaults. This supersedes CHG-103's mandatory Moment ASC order. Activity navigation continues to follow its opening list's saved order, and finance totals keep the existing date-only/full-Moment semantics.
- Activity covers support two-finger pinch, zoom buttons, Reset and drag with Done/Cancel. Zoom clamps to 1–3x and position stays within image coverage; Reset restores the centered 1x view. Existing per-photo scoped appearance preferences now include zoom and remain browser-only, excluded from backups. Original bytes, attachment references and stable IDs are unchanged. Two-finger gestures cannot trigger Activity paging.
- Code Lists expose separate Show Moments on Dashboard and Show Activities on Dashboard settings for every Moment type. The new `showActivitiesOnDashboard` flag defaults visible for legacy settings; existing Moment/legacy flags preserve their meaning. Upcoming/On This Day Activity lists and greeting Activity counts honor the independent Activity flag; recent Moment counts honor the Moment flag. Both global Dashboard section toggles remain. Existing settings serialization and backup v3 carry the additional metadata without a new collection or backup-version migration.
- **Executed final validation:** 401/401 Node tests, 92/92 Chromium journeys, ESLint, Production Vite build (2,526 modules; 65 output files), five-document inventory/73 local links/historical preservation checks and diff whitespace review passed. New journeys cover all five friendly catalogs and single-row rules/ranges at 320/390px, canonical labels, scoped sort persistence/reset/directions and unchanged totals/records, actual Chromium two-finger pinch, zoom bounds/reset/save/cancel/per-photo/account isolation, and per-type Dashboard save/reload/On This Day/counts/legacy/custom types. The full suite retains both themes at 320–1920px, reduced/short viewports, CSS zoom, original-file/scope/draft and existing behavior regressions. Visual inspection covered phone filter panels at 320/390px and cover zoom controls at 390px with zero page errors/overflow. An initial broad run was stopped after obsolete responsive-test selectors still expected the old Filters accessible name; those selectors were corrected before the passing final run. Source/mock/Chromium checks are not live cloud or physical-device proof.
- The in-app About guide and current-version notes now describe the same friendly filters, explicit sorting, cover zoom/reset and independent per-type Dashboard controls. This replaces obsolete instructions to swipe through filter controls or rely on a fixed month/newest-first history. The guide-copy refresh followed the passing behavioral suite; lint/build and the final production Guest read-back validate that final artifact.
- **Executed publication/read-back:** bumped package/lock to 1.0.34 once; authenticated local Firebase CLI published Production Hosting to permanent [DN](https://dn-10.web.app). After the guide-copy refresh, lint and Production build passed again and the final 65-file bundle was republished without another version increment. Browser-network verification with service workers blocked matched **65/65 file hashes and seven SPA routes** at `2026-10-26T09:25:24.608Z`; index SHA-256 `e991ee3092edd3282c18c2ad8ee2357025cac8f3e9baa4012efae000c3a13b48`. Fresh synthetic Guest UI confirmed About v1.0.34/Production, the five friendly Moment filter choices, visible sort control and both Dashboard sections with zero page errors/overflow. The verification browser allowed the runtime proxy's certificate; this is byte/UI evidence, not a TLS/security test. No live account business records or production originals were edited. Git publication accompanies this entry only on OldVersion.
- **Source-derived / risks / unverified:** no business-record migration, original-file edits, Rules/billing changes or main-branch writes. Full record lists and distinct filter suggestions still remain in memory; browser-only appearance/sort/filter choices do not sync or travel in recovery backups. Existing whole-Moment concurrency, local-original durability and build-size warnings remain. Native iPhone/Android/PWA gestures, OS calendars, screen readers, live signed-in cloud writes/security and cross-device behavior remain unverified. README/master/business guide are aligned within the five-document inventory.

## CHG-20261026-103 | Complete the shared filtering and story overhaul; publish DN 1.0.33
- Owner requested the complete Moments, Activities, Dashboard and existing-filter overhaul on OldVersion plus Git/Firebase publication. Started from clean local 2474fab, fetched and fast-forwarded the existing authorized work to reviewed remote base `d53a99fa4b9cc6bbc3a89bffc3535b978a2c67b6` before editing. Remote OldVersion still matched that base before release; main remained unchanged at 8989955077f70056300ca5fcf610bb84d42b509b. This entry supersedes CHG-101/102's incomplete-filter/release-candidate status; their historical text remains intact.
- Replaced every reachable legacy fixed filter panel and secondary Advanced toggle with the same embedded field/operator/value builder at each existing Filters location: Moments, global Activities, Moment Activities, global Transactions and Moment Transactions. Dynamic scoped record/recursive metadata/array discovery and optional schema/enum descriptors supply fields and actual distinct suggestions. Typed text, numeric range, calendar range/relative, boolean and set operators; nested AND/OR; removable logic-aware chips/counts; saved/recent/favorite presets; one-time legacy choice conversion; browser/account/Guest/Sample separation; debounced search/rules; and searchable keyboard/typeahead selectors with virtualized options are included. Direct Activity navigation uses the same saved conditions. Finance totals compile one date-only matcher; unrestricted OR branches preserve all-date totals, while nondate conditions narrow history only.
- Unified Moment/Activity story cards place full text/date/metadata before their owned photos/files. Multiple photos and numeric legacy IDs keep their owners; orphan links stay with the Moment. Moment lists always follow recorded Event Date ASC, with invalid dates last and no ID/creation ordering. Summary Activities also follow recorded dates. Compact Activity cards use responsive 1/2/3 columns and a bounded parent-context row, retain 44px actions, include all builder-selected statuses and derive progress from matching records. Successful empty Activity finance reads hide the entire section; errors/loading/retry remain meaningful. Menus remeasure after filter-panel collapse and follow visible anchors; dialog CSS honors reduced motion.
- Replaced the Dashboard's separate snapshot with one personalized local-time greeting: today's Activities, recent dated Moments, pending/overdue work, monthly spending/balance, dated Activity overview and encouragement. Scope/read failures do not become zeroes or stale account values. Independent persistent Moments/Activities visibility, desktop two-column bounded lists and phone stacking remain. Summary text downloads also retain file ownership.
- Review prevented derived Moment projections from reaching Edit/Archive writes. A real browser regression then exposed pre-existing normalization that replaced explicit cancellation with archived status; service/store normalization now preserves cancellation underneath the archived display state so Restore retains it. No new business field, collection, ID, backup format, file-byte transfer, Rules or billing change. Previously lost cancellation cannot be inferred automatically. The Windows documentation checker now normalizes path separators; browser tests accept an optional isolated port. README/master/business guide were aligned; exactly five approved Markdown documents remain.
- **Executed final validation:** 374/374 Node tests, 81/81 Chromium browser journeys, ESLint, production Vite build (2,522 modules; 66 output files), documentation inventory/local links/history checks and diff whitespace review passed. Chromium covers desktop/tablet/phone widths 320–1920px, both themes, reduced/short viewports, CSS zoom, filter replacement/migration/preset reuse, Guest/synthetic Account isolation, delayed-draft scope guards, original ownership/full text, empty transaction add/remove/retry, status-preserving archive/restore and geometry/keyboard/gesture regressions. Final visual inspection covered 390px and 1440px Dashboard plus the phone builder. A 50,000-record/four-field engine fixture returned 500 correct matches, with discovery 241–270ms/evaluation 24–66ms on this machine; this is computation evidence, not full browser or unlimited-data proof.
- **Executed publication/read-back:** set package/lock to 1.0.33 once, built Production, then `npm exec --offline --package=firebase-tools -- firebase deploy --only hosting --project expense-tracker-divin --non-interactive` published the tested 66-file build to permanent [DN](https://dn-10.web.app). Browser-network read-back with service workers blocked matched 66/66 file hashes and seven SPA routes at `2026-10-26T08:40:32.389Z`; index SHA-256 `c73fd58fb5e2c86bf508c045956c09498db2255acde944225b65d4ea46084168`. Direct Node HTTP verification timed out; the working browser verified the exact bytes instead. A fresh synthetic Guest browser confirmed About 1.0.33/Production, Dashboard and one Filters builder with zero page errors and no horizontal overflow.
- **Source-derived / risks / unverified:** scoped UI preferences remain browser-only, 30 saved/eight recent presets and normalized 12-level/300-node trees; records/distinct suggestions remain in memory and full record lists are not windowed. Existing whole-Moment concurrency, local-original durability and large main-chunk/mixed-Firebase-import build warnings remain. Live signed-in Firestore/security, native iPhone/Android/PWA/OS calendar behavior, screen-reader certification and cross-device behavior are unverified. No cloud business records or production originals were edited by validation. Source paths are indexed in the master; publication will be committed and pushed only to OldVersion.

## CHG-20261026-102 | GitHub source integration and gated Firebase release preparation
- PR #7 (Moment timeline/media, Activities, Dashboard, conditions and greeting polish) merged by squash commit `3a5cf6aca32b986a7d174492402a53efdd6db353` into OldVersion. Main was not modified. A post-merge GitHub validation on OldVersion completed successfully (run 40279465512); this corrects CHG-101's pre-merge statement that OldVersion was unchanged.
- Prepared source version 1.0.32 and matching package lock. Added an opt-in GitHub Actions production Hosting workflow, triggered only by an OldVersion push tagged `[deploy-live]` or authorized manual dispatch. The workflow runs npm ci, unit tests, lint, Chromium browser journeys and production Vite build before requiring a GitHub Actions service-account secret. It deploys the permanent Firebase Hosting live channel using the existing `dn-10` site and reads back the public index bytes for exact build comparison.
- **Not yet deployed:** this entry records a release candidate and pipeline preparation, not production publication. The `FIREBASE_SERVICE_ACCOUNT` GitHub Actions secret is required and its availability cannot be inspected from this connected tool. No public Firebase site, app records, backups, hosting rules, database or original-file bytes were modified in this preparation. Production success must be recorded only after the workflow deploy and read-back checks succeed.
- Validation of release branch and the new workflow is pending GitHub PR CI. Earlier integrated application behavior passed 348 unit tests, 65 Chromium browser tests, lint and production build at `84cb49e` (CHG-101).

## CHG-20261026-101 | In-progress Moment story and advanced filtering overhaul
- Owner asked to continue the 26 October Moments, Activities, Dashboard and Filters overhaul. Implemented on isolated branch `feat/moments-story-overhaul-20261026`, starting from OldVersion `8989955077f70056300ca5fcf610bb84d42b509b`. OldVersion, main and the published Firebase site are unchanged. This entry records source work, not a production release.
- Moment and Dashboard summaries now place original-backed attachments directly beneath their owning Moment or Activity descriptions, with multiple linked photos together; orphaned legacy links stay visible under the Moment. Shared lazy-loaded photo preview/download behavior is retained. Moment list rendering now enforces a single Event Date ascending timeline without alternate status/name sort or mixed past/upcoming ordering; invalid dates appear at the end.
- Activity Detail suppresses its transaction panel completely once financial loading succeeds with zero linked records, without hiding loading errors or existing transactions. Dashboard Moments and Activities sections have separate account/guest-scoped browser-local Show/Hide preferences with persistent access to both toggles.
- Added a data-discovered, type-aware nested AND/OR condition engine and mobile-responsive condition editor, with current-record field/value suggestions, chips, clear-all, saved/recent/favorite presets and account/guest isolation. Conditions are applied to Moments, overall Activities, Moment Activities, global Transactions and Moment Transactions. The existing simple filters and sort controls remain on the non-Moment surfaces for compatibility: this is a staged overhaul, **not** yet a complete replacement of legacy UI. Business records and cloud schemas are not changed.
- Source touched: MomentSummaryExtras JSX/CSS, EventSummaryDialog, DashboardOverview/CSS, Events, Activities, ActivityDetail, LinkedTransactions, Financials, EventWorkspaceShell, ConditionBuilder JSX/CSS, condition engine/hook and focused pure regression tests.
- Follow-on changes added scoped monthly spending/balance and pending Activity count to the Dashboard header, plus focused Chromium browser coverage for cross-date ordering, media ownership, separate Dashboard visibility, and saved Activity conditions. Greeting previews and downloaded HTML now use the same responsive invitation-style layout with strictly controlled classic, romantic, celebration and journey accents; greeting text remains escaped or safely rendered. The added browser regressions are part of the 65 passing Chromium tests recorded below.
- **Executed GitHub CI:** [run 40278796008](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/40278796008) at head `84cb49e65dff9ec6c0d7258c3c0a894bc679893c` passed 348/348 Node tests, 65/65 Chromium browser tests (1.3 minutes), ESLint, Vite production build and documentation governance. Chrome synthetic guest tests cover responsive viewports; this is not proof of a physical iPhone or signed-in Firebase account. No permanent Firebase deployment, device testing, migration, record deletion or new attachment-byte writes occurred. Local npm execution remains unavailable in the connected environment; GitHub Actions executed the validation.

## CHG-20261026-100 | Activity cover positioning, list-order paging, completed-edit protection and full Moment summaries
- Owner requested completed Activities to require reopening before editing, completion dates at the end, a phone cover occupying 40% of the initial viewport with photo choice and drag positioning, clean Activity cards, detail swiping in Activities order, and complete Moment summaries including photos. Reviewed clean OldVersion base `dcd7ae92ddd179bdf101e779a9b143be5ef07542`; remote matched before writes and publication; main is untouched. Source and published version are 1.0.31, continuing the authorized Git/Firebase release workflow.
- Phone covers reserve 40svh; desktop retains bounded source-informed landscape geometry. The first supported Activity-linked image remains the default; Choose cover photo reuses the original-backed gallery for alternatives. Reposition enables pointer/touch drag or arrow keys with Done/Cancel. Percent offsets clamp within the scaled original's overflow; no image distortion, cropped derivative, byte duplication or new Activity field. Choice and per-image position use existing scoped persistent UI memory by Account/Guest, Sample, both IDs and image identity; these view preferences are local to this browser and excluded from backups. Original loading/integrity, unavailable-file treatment and URL cleanup remain shared.
- Completed/legacy-completed Activity field editors are hidden/blocked until Reopen, including cancelled records retaining completion. The shared serialized writer rechecks completion when an edit executes; an obsolete editor keeps its failed draft. Explicit Cancel/Restore preserves legacy completion so it cannot bypass this rule; it never invents a completion date. List cards now contain only title/status/priority/parent/date and existing deliberate state/menu actions, with no description, gallery or expense preview. Detail keeps recorded Created then Completed dates last. Finance and original-file storage policies are unchanged.
- Detail left/right paging follows the opening Activities filter/sort order. History holds scoped ID pairs only; each target resolves from current scoped data. Direct links use shared saved filters/order. Missing/duplicate IDs, another scope, short/vertical/edge drags, selected text, controls/dialogs and cover editing cannot page or mutate records. Previous/Next controls and focus on the new heading provide a non-gesture path. No new collection or routing metadata in records/backups.
- Both Moment summaries show full notes, descriptions, memories and all photos/files without clamping or Show more. Shared original previews preserve full photo proportions; lazy images remain loaded for the open summary to stabilize scrolling and release on close. The shared dialog owns scrolling; only the topmost dialog handles keyboard focus/Escape. Dashboard summary text export includes notes, memories and filenames, without changing its text-file or backup format. Summary parent data is resolved from the active loaded scope.
- Main files: ActivityCover/ActivityDetail JSX/CSS; shared AttachmentGallery/ModalDialog; ActivityList, Activities, useActivityActions and scopedRecordActions; shared list defaults, cover-position and sequence helpers/useActivityNavigation; EventSummaryDialog, DashboardOverview, Events and new MomentSummaryExtras; browser fixtures/new cover-navigation-summary suite and existing regressions; About, package/lock, README/master/business guide. Existing records, financial precedence, attachment hashes, Account-local originals and backup-v3 format are preserved.
- **Executed validation:** `npm version 1.0.31 --no-git-tag-version`; `npm run lint` passed; `npm test` passed **342/342**, no failures/skips; `npm run test:e2e` passed **61/61**; `VITE_DEPLOY_ENV=Production npm run build` passed (2,509 modules; existing mixed Firebase import and >500 KB main-chunk warnings). `npm run check:docs -- dcd7ae92ddd179bdf101e779a9b143be5ef07542` and `git diff --check` passed: five documents, 67 local links, all 99 prior audit entries preserved. Only verified generated 1.0.30 output files were cleared before building; the resulting **58** files exactly match current build output. No additional version increment or rebuild is needed for publication.
- **Executed browser/source evidence:** ten viewport sizes in both asserted light/dark themes (320/360/390px including a tall phone, mobile landscape, tablet portrait/landscape, short/standard/large desktop), CSS 200% zoom and reduced motion. Eight new journeys cover local cover selection/per-image position/cancel/reload, 40% phone cover height, portrait/panoramic original proportions, completed/stale-editor guards, sorted/filtered paging and browser history, full summaries/nested focus/URL cleanup/text export, mocked Account preference/original isolation, and Chromium touch drag versus vertical/short/paging intent. Unit cases cover bounded crop math, sequence identity/scope/missing records, queued edit-after-completion and legacy cancellation. Retired list-preview tests were replaced with clean-card, composite identity and ID-only navigation checks. Production-build Guest previews exercised cover controls, summary photos/full text and light-theme rendering with zero page errors; no live account business data was edited.
- **Executed publication/read-back:** `npm exec --offline --package=firebase-tools -- firebase deploy --only hosting --project expense-tracker-divin --non-interactive` published the tested 58-file production build to permanent site `dn-10`, https://dn-10.web.app. HTTP read-back matched **58/58** file hashes and six SPA deep links. Index SHA-256: `b3f9c78345b7d7f4ac61c0df1261fd69707417c1ba3f265e4c22974ed993beea`; verified 26 October 2026 at 01:48 IST. No rebuild, extra version increment, Rules/Storage/billing change or business-data migration. Git publication accompanies this entry on OldVersion.
- **Executed live Guest UI:** fresh isolated Chromium verified loaded clean cards, the 40% cover, Reposition and photo choice, paging in opening order across reused child IDs without record writes, completed Edit restriction/final date, full-proportion summary photos with nested preview, and About v1.0.31/Production. Zero page errors or Firebase Storage requests. The runtime HTTPS proxy required a certificate bypass only in this test context; it is not TLS/security or native-device verification.
- **Unverified / limits:** browser Account record IO is mocked at the store edge; no live signed-in Firestore/security or cross-device proof. Real iPhone/Android touch, installed PWA/address-bar/safe-area behavior, screen readers and browser-toolbar zoom remain unverified. Cover appearance settings do not sync or travel in backups; original files still need a complete backup for recovery or another browser/device. Existing whole-Moment/cross-device concurrency and local storage durability limitations remain.

## CHG-20261026-099 | Simplify Activity Detail around actual content; publish DN 1.0.30
- Owner requested the exact compact reading order, no repeated predefined copy, all record actions under three dots, and Git/Firebase publication. Reviewed clean OldVersion base `f0afc18b9f76684be44f3c01cab20bc4b284ba48`; remote freshness matched before writes and publication. Main remains outside this change. Source and published version are 1.0.30.
- Activity Detail now reads cover → Moment: linked parent — Activity title → status/date/priority/menu → actual safe-formatted description → actual read-only transaction rows then Income/Expense/Balance → Attachments with filename and 44px preview → recorded Created/Completed dates. Thin separators divide content. Removed repeated parent details, visible section/history captions, finance navigation links, instructional/empty text, attachment counts/advice and separate Edit/state/Delete buttons. Accessible section labels and load/error/retry treatment remain; unknown secondary dates are omitted without inventing or writing values.
- Shared portaled menu contains Close (the existing completion workflow) or Reopen, Edit, Cancel/Restore and confirmed Delete as applicable; archive restrictions, duplicate guards, scope checks, announcements, editor draft/error handling and focus restoration remain. Shared finance adds a minimal presentation only: original projection/deduplication/source routing are unchanged; Moment Transactions retains its existing summary/filter/history presentation. Small attachment add/link controls, shared lazy original loading, integrity, preview/download and confirmed reference removal remain. No new collection, data migration, backup-format change, original-file duplication or account upload.
- Main files: ActivityDetail JSX/CSS; ActivityCover; ActivityAttachments; shared LinkedTransactions, AttachmentGallery and SwipeActionCard; safe date formatter/tests; browser fixtures/regressions and new `e2e/activity-detail-layout.spec.js`; About, package/lock, README, master and business guide. Existing scope, finance and attachment services are reused.
- **Executed validation:** `npm version 1.0.30 --no-git-tag-version`; `npm run lint` passed; `npm test` passed **335/335**, no failures/skips; `npm run test:e2e` passed **51/51**; `VITE_DEPLOY_ENV=Production npm run build` passed (2,504 modules, existing mixed Firebase import and >500 KB main-chunk warnings). `npm run check:docs -- f0afc18b9f76684be44f3c01cab20bc4b284ba48` and `git diff --check` passed: five documents, 67 local links and all 98 prior audit entries preserved. The new preview check was corrected to scroll the lazy gallery into view; final lint ran after the build to avoid a transient Vite temporary-config file race. Both initial check failures were validation-fixture/scheduling issues, not product failures left unresolved.
- **Executed browser evidence:** nine sizes (320/360/390px, mobile landscape, tablet portrait/landscape, short/standard/large desktop) in light/dark themes, reduced motion and CSS 200% zoom. Final content, parent/status contrast checks, menu geometry and 44px targets remain covered. Three new journeys verify actual-content order and finance totals, 44px filename previews/download access, menu-only state/edit/cancel/restore/confirmed-delete actions and focus, standalone finance/sibling preservation, empty sections and no fabricated legacy dates or opening writes. Existing Account/Guest/Sample, stale scope, retry/draft, source-routing, original integrity/object-URL and responsive regressions passed. Isolated production-build Guest previews were also inspected on narrow mobile and desktop; no signed-in data was changed.
- **Executed publication/read-back:** official CLI `npm exec --offline --package=firebase-tools -- firebase deploy --only hosting --project expense-tracker-divin --non-interactive` published the tested build to permanent site `dn-10`, https://dn-10.web.app. The final generated folder contains **54** current build files after removing 43 retained prior hashed JS/CSS assets; all current bytes stayed unchanged, with no rebuild or extra version increment. HTTP verification matched **54/54** served hashes and six SPA deep links. Index SHA-256: `413b3b83117bc2e4cd212d04bdc19b05aeddabb32e27fe89f033d8f0941d8d70`; verified 26 October 2026 at 00:56 IST. Git publication accompanies this entry on OldVersion; main is untouched.
- **Executed live UI:** a fresh synthetic Guest session on the permanent site verified the compact page, menu Close/Reopen and completion date, Edit/cancel focus return, Activity totals and retained Moment summary, locally saved PNG cover/44px preview, and About v1.0.30/Production. Zero page errors or Firebase Storage requests. The runtime HTTPS proxy required a certificate bypass only in this isolated Chromium context; this is not TLS/security, live Account or native/PWA proof.
- **Unverified / retained limits:** synthetic browser Account IO is mocked at the store edge. Native/PWA gestures, screen readers, browser-toolbar zoom, live signed-in Firestore mutations and cross-device behavior are not proven. Local originals still require a complete backup to recover or move between browsers/devices; no synchronization or native durability guarantee is added.

## CHG-20261026-098 | Local attachment originals, read-only contextual lists and universal transaction creation
- Owner explicitly requested browser-local attachment originals with cloud filename metadata, no transaction editing in Activities/Moments, read-only Moment Activity cards, removal of Timeline, and publication to Git/Firebase. Follow-up clarified that contextual Add Transaction controls must also go because universal + already exists. Reviewed clean OldVersion base `3b30772637d4abbc40dde397e7519825c3dfca69`; fetched remote before writes and verified the identical local/remote tree. Main is untouched. Source version is 1.0.29.
- All new originals now save to the existing scoped IndexedDB repository for Account, Guest and Sample, with SHA-256 identity/integrity and the existing 10 MB file limit. Firebase stores the filename and required reference metadata (ID, hash, type/size/time and Activity link), never original bytes. Local-save failure creates no successful attachment reference. Guest sign-in transfer and backup restore copy originals into the destination browser scope, with no Storage upload. Reads first check local scope, allowing restored originals to work with retained legacy cloud markers; missing-local legacy cloud references retain read-only compatibility. No existing record/file is migrated or deleted. Device-only availability and backup transfer are stated in attachment areas/About/guide; metadata alone cannot recover missing bytes.
- Contextual transaction history in Activity Detail and Moments now uses read-only shared rows: normal selection/swipe cannot edit/delete, Details stays accessible, and Manage transactions links to main Finance. Removed contextual Add Transaction and existing-expense linking from Activity lists/detail/workspace. Universal + is the sole creation entry and presets the current Moment or both IDs/date on Activity Detail. Its guarded form preserves the route and failed draft, blocks repeated submissions/dismissal during save, rejects obsolete scopes and restores focus to the persistent + control. Main Finance retains edit/delete/link selection and its original source-routing/deduplication rules.
- Moment Activities uses read-only cards without menus, completion swipes/shortcuts or child/finance mutation callbacks; normal/keyboard selection still opens canonical Activity Detail, where Activity actions remain available. Removed Timeline UI/content. Five sections remain Overview, Activities, Transactions, Memories, Attachments; old Timeline URLs resolve to Overview as a non-writing compatibility alias. Shared menu semantics omit action disclosure attributes when a card has no actions. Existing Activity/Dashboard mutations elsewhere are retained.
- Main files: attachmentService and tests; ActivityAttachments; guestMergeService; ActivityList; TransactionHistory; LinkedTransactions; EventWorkspaceShell and handler fixtures; Activities and handler fixtures; DashboardLayout; momentWorkspaceRoutes/App; design-system CSS; ActivityDetail; About; package/lock; documentation checker, README/master/business guide and browser suites including new `e2e/local-attachments-readonly.spec.js`. Unreachable contextual mutation handlers/dialogs were retired. No Activity/finance collection, data migration, backup-v3 format change, Firebase billing/bucket/Rules or unrelated finance changes.
- **Executed:** `npm version 1.0.29 --no-git-tag-version`; `npm run lint` passed; `npm test` passed **335/335**, no failures/skips; `npm run test:e2e` passed **48/48**; `VITE_DEPLOY_ENV=Production npm run build` passed (2,504 modules, existing mixed Firebase import and >500 KB chunk warnings). `npm run check:docs -- 3b30772637d4abbc40dde397e7519825c3dfca69` and `git diff --check` passed; five approved Markdown documents/current links and all 97 prior audit entries preserved. Obsolete contextual transaction-creation tests were replaced with read-only wiring/navigation checks; equivalent creation/failure/duplicate/scope coverage moved to universal + browser journeys.
- **Executed browser/source evidence:** 320/360/390 px, mobile landscape, tablet portrait/landscape, short/standard/large desktop in light/dark themes, reduced motion, CSS 200% zoom and selected contrast/focus/44px geometry checks. Browser journeys verify five reachable tabs, retired Timeline Overview, read-only cards/finance, retained main Finance editing, universal + presets/failed draft/retry/pending guard/focus/scope invalidation. Synthetic Account record stores with real IndexedDB verified local PNG preview, reload, metadata shape without bytes, backup/restore byte equality, distinct account isolation and unavailable-original fallback with **zero Firebase Storage requests**. Unit cases cover local failure, stale save results, legacy-marker local recovery, integrity, same-scope deduplication and no cloud writes. Guest/Sample regressions remain covered.
- **Unverified / limits:** Account record IO in browser tests is mocked at the store edge; live signed-in Firestore writes and deployed authorization are not proven. Real native/PWA gestures, storage retention/eviction, screen readers, browser-toolbar zoom and cross-device journeys remain unverified. Originals are browser/origin-local and need a complete backup for another device/browser or recovery; removing site data or losing the device can lose them. Existing whole-Moment/cross-device concurrency and cross-collection compensation limits remain. No native/cloud-storage or synchronization guarantee is claimed.
- **Executed Hosting publication:** official Firebase CLI through `npm exec --offline --package=firebase-tools -- firebase deploy --only hosting --project expense-tracker-divin --non-interactive` published the tested 1.0.29 production build to permanent site `dn-10` / https://dn-10.web.app. No extra version increment or rebuild was performed after validation. HTTP read-back verified all **55/55** served files byte-for-byte and six SPA deep links, including the retired Timeline path, against the built index. Index SHA-256: `e99a8e9ef87fd06174e1d126d025a0886deff05bbdd6d8ebfae4048c60006c6a`. Verified 26 October 2026 at 00:30 IST. Master and business guide now reflect publication. Git publication accompanies this change; main remains untouched.
- **Executed live Guest UI:** isolated Chromium at 390px verified five workspace links, read-only Moment cards/transaction rows, keyboard navigation to Activity Detail, universal + both-ID preset/cancel, local PNG cover, no contextual Add transaction, Timeline-to-Overview compatibility and About v1.0.29/Production. Zero page errors or Firebase Storage requests. This synthetic Guest session changed no signed-in business records. The runtime's HTTPS proxy required a certificate bypass in this isolated test context; this is not TLS/security, Account, native-device or PWA verification.

## CHG-20261025-097 | Publish and verify DN 1.0.28 on Firebase Hosting
- Owner explicitly authorized Firebase publication. Source is OldVersion `fcdaeccbbb791d9d3c37ffebb953c0424938e53c`, whose tree matches the locally reviewed implementation; GitHub governance run 40220345516 passed Node tests, lint, 43 Chromium journeys, build and documentation checks. The earlier Git publication block was resolved by the owner's explicit approval and publication through the connected GitHub app.
- **Executed:** authenticated with the official Firebase CLI; built existing prepared version 1.0.28 using `VITE_DEPLOY_ENV=Production npm run build`, then `firebase deploy --only hosting --project expense-tracker-divin --non-interactive` through npm exec. Build passed with existing chunk/import warnings. Deployment to permanent site `dn-10` completed successfully. No additional version increment, Firestore writes, Storage/billing/Rules changes or data migration.
- **Executed HTTP verification:** all 55 served build files matched local SHA-256 bytes; Dashboard, Activities, nested Activity Detail, Moment Transactions and About deep links returned the matching app shell. Index SHA-256: `a14273fee5fb6e9b25d59427363e1c1cffeb827438b59856787378e23655a5e2`. Verified at 23:57 IST on 25 October 2026. Master and business guide now reflect publication; previous audit text remains unchanged.
- **Unverified:** signed-in business mutations, account Storage, real native/PWA devices, screen-reader behavior and cross-device synchronization. Deep-link shell checks are not signed-in record tests. Prior local responsive/interaction evidence and limitations remain in CHG-095.

## CHG-20261025-096 | Local implementation checkpoint; GitHub publication blocked pending approval
- The implementation and local verification in CHG-095 were committed on OldVersion as `021d98bbd5d4dd9c2152d735c1280a0eb6929afe` (`Add scoped Activity detail and Moment transactions`). This entry records delivery status only; it changes no application code, records or build inputs. CHG-095 and all earlier entries are preserved.
- **Executed / Blocked:** `git push origin HEAD:OldVersion` was rejected by automatic approval review: publishing repository source/metadata is external egress and the application-update request did not explicitly authorize publication to the remote branch. No workaround or second push was attempted. Publication requires the owner's explicit approval.
- **Executed read-only:** `git ls-remote --heads origin refs/heads/OldVersion` still returned `2474fab770951c9d84402d3449d0e70fc88a4717`. The source commits remain local; no new GitHub CI result, Hosting deployment or production read-back is claimed. A reviewable patch is provided with the delivery response. Local application verification remains the evidence in CHG-095.

## CHG-20261025-095 | Activity Detail, Moment Transactions and deliberate Activity actions; prepare DN 1.0.28
- Owner requested the dedicated Activity page together with Moment grouping, contextual Transactions and simpler Activity cards. Reviewed clean OldVersion base `2474fab770951c9d84402d3449d0e70fc88a4717`; remote freshness matched before implementation and again during final review. Main is untouched. Package/lock and About prepare source **1.0.28**; no Hosting deployment was requested or executed. The latest verified published release remains 1.0.27 in CHG-094.
- Added `/events/:eventId/activities/:activityId`, resolving the exact scoped parent and nested child after authentication/data loading. The page reuses the Activity editor, safe rich-text renderer, transaction coordinator, gallery and original repository. It includes stable loading, focused retry/not-found states, archived context, in-place editing/state actions, finance and attachment workflows. Its single reserved landscape cover selects the first supported Activity-linked original/compatible HTTPS image in existing order; Moment-only photos are excluded, failed/metadata-only originals use a theme-aware fallback, and gallery preview/download remains available. Object URLs are released; no image bytes, crops, cover field, attachment hashes or stored descriptions are changed by opening the page.
- Added `/events/:eventId/transactions` and the six-section order Overview, Activities, Transactions, Timeline, Memories, Attachments. Overview now provides compact content summaries/links without loading attachment originals. The Transactions section reuses shared finance normalization/history/forms: typed ledger first, unified legacy second, nested expenses last, once per ID within its kind, preserving first values and known account sources. Deduplication occurs before Moment filtering. Full-Moment finite INR totals are independent of search/type/Activity/month filters; filters persist separately by scope/Sample/Moment and retain unavailable selections. The nested tier is rebuilt from live Activities so child deletion removes nested-only costs while retaining standalone finance. Add/edit/cancel/retry stay on the current route.
- Normal Activity selection across the overall list, Moment workspace and both Dashboard date views opens Activity Detail. Main navigation is Home (Dashboard), Activities, Moments, retaining existing labels/icons/Quick Create; the nested Activity route activates Activities and other Moment routes activate Moments. Cards no longer reserve a circular completion column. Deliberate left swipes Complete/Reopen, with distance/velocity and vertical-scroll safeguards; cancelled swipes only expose explicit menu actions, never Restore or Delete automatically. Transparent 44px three-dot triggers reuse portaled viewport-bounded menus, with keyboard state alternatives, Edit, contextual finance, Cancel/Restore and confirmed Delete last. Dashboard Ctrl/Command+Enter remains supported. Status updates use live announcements; failed edits/swipes retain recoverable drafts/records and block repeated submission.
- Activity and finance-mirror writers share a serialized scoped parent queue, resolve the latest child at execution, and preserve unrelated parent/Activity/nested-expense fields. Scope revisions guard late completion/rollback including A → B → A; Sample ownership guards loading and a missing fixture fails closed. Malformed/unreadable Guest Moment, income and expense reads propagate into focused loading errors instead of false missing/empty states or destructive overwrite attempts. Runtime scope/optimistic-create IDs remain store-only. Guest originals stay in scoped IndexedDB; Account references still require confirmed cloud originals, with no account-local fallback. No standalone Activity or Moment-finance collection, copied ledger, data migration or backup-format change was introduced. Existing multi-device/other whole-Moment concurrency and cross-collection compensation limits remain.
- Main additions: `src/features/activities/ActivityDetail.jsx`/CSS and cover/attachment components; `src/features/finance/components/LinkedTransactions.jsx`; `src/features/events/components/MomentContents.jsx`; shared scoped Activity/finance/original-loading hooks and `scopedRecordActions`/`activityDetail`/`momentTransactions` utilities; browser suites under `e2e/`; ESLint/Playwright configuration with an isolated Vite browser-test cache, and `scripts/check-documentation.mjs`. Main updates: App routing, DashboardLayout, Activities, EventWorkspaceShell, DashboardOverview, ActivityList, SwipeActionCard/SwipeToComplete, gallery/dialog/transaction-history/rich-text components, scoped stores/coordinator/event normalization, Guest event/income/expense readers, design tokens usage, package/lock, About, README, master and business guide. CI now includes lint, Chromium regressions and documentation checks alongside Node tests/build. DashboardActivityEditor is retained and reused.
- **Executed locally:** Node `v24.22.1`; baseline `npm ci`, development dependency installation, `npx playwright install chromium`, and `npm version 1.0.28 --no-git-tag-version`. Final `npm run lint` passed; `npm test` passed **336/336**, no failures/skips; `npm run test:e2e` passed **43/43** Chromium journeys; `npm run build` passed with **2,504 modules**, retaining the existing mixed Firebase config import and >500KB main-chunk warnings. `npm run check:docs -- 2474fab770951c9d84402d3449d0e70fc88a4717`, `node scripts/check-audit-log.mjs 2474fab770951c9d84402d3449d0e70fc88a4717` and `git diff --check` passed: five approved Markdown documents, valid current local links, all 94 earlier entries preserved, newest-first order. Added/updated regression coverage includes exact nested IDs/deep links/refresh/back-forward, loading/scope changes, A → B → A writes, missing Sample fixtures and malformed Guest reads/retry, swipe distance/velocity, finance precedence/provenance/finite totals, standalone retention, siblings/unknown fields/runtime metadata, safe notes, failed edits/transactions/swipes, duplicate requests, menu/focus/keyboard behavior and original loading/release/integrity. Browser validation exposed and corrected menu capture/queued-scroll dismissal, dialog focus restoration, native text-drag interference and a Dashboard flex-layout defect.
- **Executed responsive/browser evidence:** Chromium at 320×640, 360×740, 390×844, 844×390, 768×1024, 1024×768, 1280×480, 1440×900 and 1920×1080 in light/dark themes, plus reduced motion and 200% CSS zoom. Checks cover long titles/parent names/descriptions, six non-wrapping reachable links with active reveal, filter overflow, 44px menu targets, final detail content above the bottom dock, semantic headings/names, keyboard/menu/dialog focus and selected small-text contrast ≥4.5:1. Original-file cases include portrait, square, panoramic, 1px, unavailable/no-cover and 18 references sharing one stored original, with downloaded SHA-256/size unchanged. Chromium CDP touch emulation exercised short/vertical/deliberate-left movement; mouse and keyboard checks exercised Complete/Reopen, cancelled explicit Restore, duplicate blocking and failed-completion retry. Synthetic Account reads stop at the store edge; Guest IndexedDB originals and isolated development Sample mutations were executed. Browser reports/screenshots are generated under ignored `.verification/` rather than added as specification documents.
- **Source-derived / Unverified:** existing safe-area spacing, source routing, backup format and no-migration behavior were reviewed and covered by source/mock tests; they are not live Firebase/security proof. Real iPhone/Android gestures, installed PWA safe-area/keyboard behavior, native browser-toolbar zoom, screen-reader announcements in assistive software, cross-device races, signed-in cloud mutations and Storage upload/recovery were not executed. Selected automated contrast/focus/semantics checks do not certify overall accessibility. Account Storage remains blocked by the previously observed missing bucket/billing setup in CHG-090; no billing, bucket, Rules or CORS changes were made. No deployment, production read-back or cross-device synchronization guarantee is claimed.

## CHG-20261024-094 | Lightweight filter row and Moment type; publish DN 1.0.27
- Owner requested removal of priority from the Status dropdown, smaller/lighter filter boxes, Moment type beside Moment and sideways access to visibility instead of More. Reviewed clean OldVersion base `0601a65fd47b888842f4d00fbff8e0d09b98c728`; remote matched before edits. Existing release authorization covers this follow-up.
- Shared inline filter fields are now borderless/transparent with smaller horizontal padding while retaining readable 14px values and 44px tap height. Activities uses Status, Moment, Moment type, then Moment visibility in its existing horizontal rail. Removed the More disclosure. Sort remains on row two and tiny Reset on row three. Status contains All/In progress/Completed/Cancelled; persisted priority filter values normalize to All, without removing stored priority or priority sorting.
- Type choices use existing Moment records, including custom Other labels. Type selection filters the Moment picker, activity list and progress together, clears an incompatible selected Moment, persists per account/Guest and clears on Reset. Missing saved types remain identifiable with empty results. No record writes, migrations, backup changes or account/Firebase Storage/billing/Rules changes.
- **Executed:** 318/318 Node tests passed, production build and diff check passed. A handler regression verifies status options, custom type filtering, compatible/incompatible Moment selection, progress, Reset and zero business writes. Local 372px Guest browser inspection confirmed borderless controls, horizontal access to type/visibility, four Status choices, in-place type selection, and retained sort/reset. **Unverified:** native phone touch/keyboard behavior. Existing build chunk-size/Firebase import warnings and Storage limitations remain.
- **Executed publication:** official Firebase CLI 15.34.1 deployed the tested 1.0.27 dist to permanent site `dn-10` in `expense-tracker-divin`; build timestamp `2026-10-24T04:33:04Z`. All 46 served files and four SPA routes matched build SHA-256 hashes; index `35e43b901b16040b3486843ff1fab5fb48c9d8bf1a69b3119bd7d68fc6297abe`. Production About showed 1.0.27/Production with the updated notes. About, master and business guide are aligned; Git publication accompanies this change. Earlier CHG text is preserved.

## CHG-20261024-093 | Simplify Activity filters and publish DN 1.0.26
- Owner requested Status remain prominent, archived visibility be hidden by default, clearer Moment dropdowns and a replacement for Dashboard activity chevrons. Reviewed clean OldVersion base `aeda87707ceb940cf85bcff167685822ae504d76`; remote freshness matched before writes. Existing session publication authorization covers this follow-up.
- Activities puts Status first and Moment second, with Moment visibility under a closed-by-default More disclosure. The Moment picker follows current visibility, defaults to unarchived, preserves identifiable saved selections and no longer switches visibility to all on selection. Explicit visibility changes clear incompatible Moment selections. Existing Status/priority options, sort row and tiny Reset remain. Filter triggers use 14px text; options use 15px text/44px minimum height; menus request 220px minimum width, 280px for the Moment filter, constrained to the viewport. Upcoming Activity rows use a pencil and On This Day rows a book; actions and swipe completion are unchanged.
- **Executed:** full Node suite passed 317/317; focused page/dashboard suite passed 22/22; production build and diff check passed. Local 372px Guest inspection confirmed Status first, More initially collapsed/reachable, larger readable Moment dropdown, and retained sort/reset rows. The new handler fixture checks archived-option exclusion, visibility preservation on selection, incompatible selection clearing, Reset, and no business writes. Native device behavior remains unverified.
- **Executed:** official Firebase CLI 15.34.1 published the tested 1.0.26 dist to permanent Hosting site `dn-10` / project `expense-tracker-divin`, build timestamp `2026-10-24T04:23:00Z`. All 46 served files and four SPA routes matched their validated SHA-256 hashes. Index hash: `c866c3b6cc9037985cb226d482fe84adb6c123bf0540e7da5953aac967d915ad`. About, master and business guide reflect the update. The master architecture paragraph also corrects its stale 1.0.24 publication summary; CHG-092 already recorded the actual 1.0.25 release.
- Compatibility/risks: no record migrations, backup changes, account writes or Firebase Storage/billing/Rules changes. Active continues to mean unarchived; previously saved explicit visibility choices remain remembered. Existing build chunk-size/Firebase import warnings and Storage/native-device limitations remain. Historical CHG entries are preserved; Git publication accompanies this change.

## CHG-20261024-092 | Publish and verify DN 1.0.25
- Date: 2026-10-24. Owner-authorized release commit `99118f9fe758ff7c88f3255e608fcd2bd0cc6f20` was pushed to OldVersion from reviewed base `dc5e12898210ca56701112094eaac7362e7ed049`; main remains `a7f5c26d6e43a971b1461b101f8823129de12cf6`. GitHub Actions [run 40061209330](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/40061209330) passed governance. The opt-in Firebase usability preview ([run 40061209332](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/40061209332)) was skipped as configured.
- Executed: version 1.0.25 production build passed (2,489 modules, build timestamp `2026-10-24T04:07:58Z`) with the existing mixed static/dynamic Firebase config and >500KB main chunk warnings. `npm test` passed 316/316. Official Firebase CLI 15.34.1 deployed only Hosting to project `expense-tracker-divin`, permanent site `dn-10`, [https://dn-10.web.app](https://dn-10.web.app). The exact validated `dist` was deployed directly; 45 of 45 served files matched their build SHA-256 values and `/`, `/dashboard`, `/activities`, `/settings/about` returned the matching app shell. Index SHA-256: `8eed0276814328a21d920204a383485b9e73903f26b9b7f31b68d297d3e27f6b`; service worker SHA-256: `49c53d1fcfe3afc1bf125a9f15fd08d005ecf4dc3758635c8fff5f144e09168d`.
- Executed production About read-back showed `v1.0.25`, `Production`, and the new What's New and usage guide. Its Refresh app action applied the release to the existing signed-in browser and rendered the same version. No business records were edited during production verification. The synthetic Guest browser flow and full filter checks are documented in CHG-091. The master and business guide now identify 1.0.25 as published.
- **Source-derived:** Existing attachment/account Storage limitations, storage layout and backup semantics are unchanged. **Unverified:** native iOS/Android touch/keyboard behavior, and signed-in account-photo upload/recovery remain unverified/blocked by the pre-existing account Storage/billing setup in CHG-090. Hosting release changes no account data, schema, Storage, billing, Rules or CORS.

## CHG-20261024-091 | Prepare Dashboard activity actions and compact inline filters
- Date: 2026-10-24. Owner-authorized implementation is prepared from OldVersion base `dc5e12898210ca56701112094eaac7362e7ed049`; pre-write remote freshness check matched OldVersion at that SHA and main remained `a7f5c26d6e43a971b1461b101f8823129de12cf6`. No branch switch, account-data mutation, schema migration, backup-format change, or Firebase rules/storage change.
- Dashboard Upcoming Activity rows now open an in-place editor for the selected title, date, priority and notes. A deliberate horizontal swipe or Ctrl/Command+Enter completes that exact activity. Vertical scrolling, taps and short/diagonal drags do not. Completion preserves notes and the existing record, marks it complete, then removes it from Upcoming. On This Day activity rows retain their parent-workspace navigation. Writes resolve current account/Guest/sample scope and latest parent/child, serialize same-Moment writes, reject stale targets, and retain the draft on save failure. Activities remain nested under their existing Moment; no new module or storage collection is introduced.
- Shared list filters now dismiss on an outside click after that click's target action resolves; owned dropdown portals and controls inside the panel remain usable. Existing sort controls occupy the second row; Reset is on the third as 11px muted text with a transparent 44-by-32px touch area. Existing filter/search/sort persistence and filter choices remain unchanged. About, master and owner-facing guide reflect the behavior.
- Executed: `npm test` passed 316/316 with no failures/skips; `git diff --check` passed. Guest browser journey at 372px tapped and edited a selected activity on Home, saved notes, reloaded and confirmed persistence without route change; a short drag did not complete, a deliberate swipe completed once and persisted, then the activity remained visible as completed in Activities with its notes and attachment preview. Filter behavior was checked for outside dismissal with preserved checkbox action, dropdown selection, Search focus/action, Sort row, Reset row dimensions/style and restored defaults. Actual iOS/Android native touch/keyboard behavior is unverified. Production build, CI, commit/push, Hosting publication and production read-back remain pending for CHG-092.
- Risks/limits: activity data still uses whole-Moment persistence with its existing cross-view concurrency limits outside the new dashboard per-Moment lock. Offline persistence/sync guarantees and account Storage setup are unchanged. A narrow desktop viewport plus handler fixtures do not prove native phone gesture behavior.

## CHG-20261023-090 | Publish and verify production 1.0.24; identify account-photo prerequisite
- Date: 2026-10-23. Owner-authorized implementation `06838843fd1e236da2e871d7ae36349ba92f0d8c` was committed and pushed normally to OldVersion; main remained `a7f5c26d6e43a971b1461b101f8823129de12cf6`. The commit includes the complete CHG-086–089 local change set and package/lock 1.0.24. No branch switch, force push or account-data mutation.
- Executed: GitHub Actions [run 39985781673](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39985781673) passed documentation governance and application smoke tests. The opt-in preview was skipped as intended. Local 284/284 tests and the production build passed before publication. The official Firebase CLI 15.34.1 deployed only Hosting to project `expense-tracker-divin`, permanent site `dn-10`, https://dn-10.web.app. The validated dist was published directly without another version increment or rebuild. Build timestamp: 2026-10-23T16:16:13Z.
- Executed HTTP read-back: all 44 files returned 200 and matched their validated SHA-256 bytes; root, Dashboard, Activities and About SPA routes matched the tested index. Index hash: `d69621cd2c2615b6212ab4649c080e55f2c4d39ce47c6420d4093a211283d8ee`; worker hash: `0ff1fc7a165a813e26fb46d3e08f99aa771caa37ce4c1aa5777beb84c961a94d`. Production UI showed 1.0.24/Production and both Dashboard controls were transparent, 40px high, with no All Moments/All Activities buttons or horizontal page overflow. Inspection made no business-record changes. Native-device checks remain unverified.
- Executed authenticated, read-only Firebase checks: configured/default Storage bucket metadata returned 404; project bucket listing succeeded with zero buckets; rules inventory had no Storage releases; Cloud Billing metadata reported `billingEnabled: false`. Account original photos therefore remain blocked by missing infrastructure, rather than merely untested client code. [Firebase's current requirement](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024) is Blaze billing for Storage. Enabling a paid plan and provisioning/verifying private file storage requires the owner's approval/setup; neither billing, bucket, Rules nor CORS was changed. Failed account file saves do not report success or create a metadata-only reference; Guest originals remain local and portable through backups.
- Updated master/business guide to published status and the concrete account-photo limit. This evidence/documentation follow-up changes no application/build inputs and needs no Hosting redeployment. Prior CHG text remains unchanged. Hosting/Git implementation publication is complete; account-photo provisioning, signed-in file journeys, cross-user access checks, offline synchronization and native phone behavior remain outstanding as described in the master.

## CHG-20261023-089 | Prepare DN 1.0.24 with lighter dashboard controls
- Date: 2026-10-23. Owner approved committing/pushing the accumulated CHG-086–088 implementation and publishing permanent Firebase Hosting, after making the Dashboard's two date switches lighter and removing All Moments/All Activities. Reviewed OldVersion base `89767c50581274c9c098984d83d4473c5e8a69e4`; remote still matched that SHA and main remained `a7f5c26d6e43a971b1461b101f8823129de12cf6` before writes.
- Both Dashboard cards use 12px inline Upcoming/On This Day text controls, transparent backgrounds, no segmented box/shadow and a 1px active underline. Touch height remains 40px and focus/pressed state remains explicit. Removed the two All shortcuts; existing main navigation reaches Moments and Activities. Counts, date rules, bounded lists and row actions are unchanged. Clear Local Data now explicitly says original file objects and account records are retained, matching its implementation.
- Prepared package/lock version 1.0.24 without changing dependencies. Master, business guide and About describe the lighter controls and release state. This release includes the previously reviewed local module/navigation, compact filters/transactions, visual editor, greetings and original-file work in CHG-086–088; those historical entries remain unchanged. No database migration, Rules, bucket, billing or account-data changes are included.
- Executed: full `npm test` passed 284/284, no failures/skips; 22 targeted dashboard/date/greeting tests passed. Production build for 1.0.24 passed with 2485 modules, retaining the existing main-chunk and mixed Firebase config import warnings. Local 372px Guest browser inspection confirmed both transparent 40px text-switch groups, correct switching/empty states, no All buttons and no page overflow. Main navigation remains reachable. Original-file/account/native-device limits in CHG-088 remain; source review alone does not verify Storage bucket/rules/CORS or account recovery.
- Publication/production read-back evidence will be recorded separately after execution. Version bump and production build are kept separate from direct Hosting deployment so the validated build bytes can be published unchanged.

## CHG-20261023-088 | Compact everyday controls, quiet writing and retain original attachments
- Date: 2026-10-23. Owner requested smaller inline filters and transaction records, combined Dashboard date views, removal of Home Insights, quieter form writing, improved greetings and Activity photo previews. Reviewed base `89767c50581274c9c098984d83d4473c5e8a69e4` on OldVersion with remote matching that base; preserved the local CHG-086–087 work. No branch switch, commit, push or deployment; version remains 1.0.23.
- Filters retain the existing page and dropdown/sort logic in one horizontal row, approximately 52px high, with inline labels, sideways swiping, Reset and 44px arrow targets. Transactions use 13px title/amount and 11px metadata, with linked context and notes under native inline Details; sample rows measured approximately 88px collapsed. No saved transaction content was removed. Dashboard has separate Moments and Activities cards, each switching between Upcoming and actual same-calendar-day dates in prior years with a bounded 220px list. Removed View Insights from Home; Profile access remains. Moment history respects type visibility/archive/cancellation and does not treat every matching monthly day as an anniversary.
- All multiline fields now lazily load the existing visual Tiptap editor at every width. Removed permanent toolbars, Edit/Preview modes and word count. Nonempty text selection shows compact styles; Ctrl/Command+B/I, undo/redo and Alt+F10 support keyboards. Stored Markdown strings and untouched whitespace remain compatible; unsupported nesting/paste/required-text guards remain. Literal newly typed Markdown markers retain the existing grammar limitations. Greeting preview and escaped standalone HTML download share the same card design, with personalized text and restrained frame/typography.
- Originals up to 10 MB are addressed by SHA-256 and stored once per owner scope. Guest/sample files use isolated IndexedDB keys; account files use lazy Firebase Storage at `users/{uid}/attachments/{assetId}` and require confirmed upload before a record reference is saved. Parent attachment references can optionally link to an Activity; workspace and overall Activities show previews, while Attachments provides previews/removal and original download. Near-viewport loading and object-URL cleanup avoid fetching every offscreen file; viewer interactions do not open the underlying activity menu. Async saves recheck current owner, Moment, activity, route and mounted state, preserve the latest parent and guard duplicate submission. Removing a reference retains the original object; automatic orphan cleanup is not implemented.
- Compatible v3 JSON backups add optional deduplicated `attachmentFiles` byte payloads. Export/read/restore verify original hashes; validation rejects missing files, invalid sizes/base64/references and duplicate payloads. Both complete export and import are limited to 50 MB JSON; an oversized or unreadable backup fails instead of downloading a partial copy. Restore stores originals in the destination before record writes. Guest sign-in uploads originals before the Firestore batch and retains guest records/files on failure; owner/snapshot checks prevent subsequent stale work. Old metadata-only attachments cannot reconstruct originals and require reattachment. Existing IDs, stored note strings, guest/account boundaries and merge conflict policy remain.
- Executed: full `npm test` passed 284/284 with no failures or skips; final `npm run build` passed with 2485 modules. The existing main-chunk warning and mixed static/dynamic Firebase config import warning remain. Five-document/branding tests, diff whitespace and newest-first audit checks passed; all 85 committed historical entries remain unchanged. New real-handler/pure tests cover original-byte integrity, deduplication, scope isolation, denied uploads, corrupt/missing file rejection, activity preview parent identity, upload-before-record ordering, duplicate/retry guards, session changes, unmount/route changes and restore failures. Editor tests use real ProseMirror handlers; date/history and escaped greeting export tests pass. Mocks do not establish cloud security or account recovery.
- Executed local synthetic Guest browser checks: compact filters and transaction Details at phone/desktop widths; 372px phone and 1440px desktop layouts had no page overflow. Ctrl+B produced visible bold, undo returned plain text and selected text showed contextual styles without an ordinary-writing toolbar. Combined Dashboard views and removed Home Insights were inspected. File chooser → activity assignment → preview → reload/overall Activities → original download succeeded; downloaded bytes matched the input SHA-256. Backup JSON included one 68-byte original with matching hash/activity reference; same-backup Guest restore completed and the photo remained available. Greeting preview was inspected on phone/desktop. Development dependency-cache 504 errors were diagnosed and resolved by restarting Vite with forced optimization; no source workaround or dependency change was required.
- Source-derived: lazy Storage/account paths and safe failure ordering; no migration, Rules/configuration, package or dependency changes. Unverified: live bucket provisioning, Storage rules/CORS/cross-user isolation, signed-in file upload/read/backup/restore, interrupted cloud recovery, native phone keyboard/selection/gestures/PWA behavior and production publication. Whole-Moment concurrent-write, offline outbox and automatic backup limitations remain. Updated master, business guide and About.

## CHG-20261023-087 | Embed filters and consolidate creation under universal plus
- Date: 2026-10-23. Owner requested on-page filters, no automatic strikethrough on completed activities, and removal of duplicate creation buttons. Reviewed base `89767c50581274c9c098984d83d4473c5e8a69e4` plus the preserved local module work in CHG-086; remote OldVersion still matched that base. No branch switch, commit, push or deployment.
- Shared ListControls now expands inline on Moments, overall/workspace Activities and Transactions, using the existing dropdowns/sort controls. Overflow stays in a horizontal swipe strip with previous/next controls; result counts and page content remain available. Removed filter-modal/sheet styling and body-lock use. Insights remains search-only. Completed activity titles retain checkmarks/status without automatic crossing out.
- Universal + is the single page-level creation entry. Removed duplicate Moment/activity/transaction header and empty-state buttons plus memory/attachment hero/section buttons. Inside a loaded Moment, + adds contextual Memory and Attachment options; Activity preselects that Moment. Existing edit/save forms, query deep links and contextual record actions remain. Memory/file selection resolves the latest matching scoped parent; attachment picker activation remains synchronous within the click gesture, with an always-mounted hidden input across workspace sections.
- Compatibility: no record schema, backup format, Firebase configuration, package version or dependency changes. Existing attachment handling still stores metadata only; original-file persistence is not implemented by this cleanup. No production business records were changed.
- Executed: `npm test` passed 240/240 with zero failures/skips; `npm run build` passed, 2467 modules, retaining the known large-main-chunk warning. Six new real-listener regressions cover matching action/context, wrong account/load/Moment rejection, synchronous input clicks, delayed-save scope checks, listener cleanup and no unexpected writes; their stores/input are mocked and do not prove a native file picker. Updated obsolete creation-button contracts to verify the remaining universal entry paths. Existing activity/transaction/backup suites passed.
- Executed local Guest browser checks: inline filters on Moments, Activities and Transactions produced no dialog, backdrop or page scroll lock; sideways controls and immediate Completed filtering worked with retained scroll position. Computed completed-title decoration was none. Global and workspace page Add controls were absent, + exposed contextual Memory/Attachment, Activity preselected the current Moment, and the existing Memory form opened and cancelled. Light 320px, dark 390px and desktop 1280px checks had no horizontal page overflow. Native attachment-picker selection, live account writes and production publication remain Unverified.
- Updated master, business guide and About for the resulting behavior. Historical entries remain intact; five-document inventory and diff checks passed. Changes remain local for review with the prior module changes.

## CHG-20261023-086 | Add overall Activities using DN's existing interface
- Date: 2026-10-23. Owner rejected the separate UI prototype and authorized implementing the module/navigation change in the existing app with current UI/UX logic. Reviewed clean base `89767c50581274c9c098984d83d4473c5e8a69e4` on OldVersion. Remote SHA matched that base after the sandbox DNS failure was resolved through an approved read-only check.
- Added `/activities` as an overall view of existing nested activities, using the current cards, forms, search/filter/sort controls, swipe menus, progress and transaction coordinator. Filter by parent Moment, archived-parent visibility, status or priority; sort across parents. Parent links retain the existing Moment workspace. Add/edit, complete/reopen, cancel/restore, confirmed deletion, transaction creation and existing-expense linking preserve original record identities and other nested data.
- Main navigation is Home, Moments and Activities with the existing Quick Create action; Profile provides Transactions, Insights and Settings alongside account/logout controls. Both existing mobile grid rules now fit the four controls. Dashboard adds a separate bounded Activities card for pending dates today through 30 days and actual same-day dates from previous years, honoring Moment-type visibility and archive/cancellation rules.
- Compatibility: no storage schema, migration, backup format, package version, dependency or Firebase configuration changes. Global presentation uses containing-parent identity and composite keys to isolate reused activity IDs and linked expenses. Form saves re-resolve current scoped data; an old account's update success/rollback cannot overwrite a newly loaded scope. Activity date rendering accepts legacy dates/Timestamps safely, and Link expense is also reachable before the first linked expense. Whole-Moment concurrent-edit and existing offline/photo/backup limitations remain.
- Executed: `npm test` passed 234/234 with zero failures/skips, including 27 new projection/dashboard/real-handler/store tests. Final `npm run build` passed with 2467 modules; existing main-chunk warning remains. Existing backup/restore suites passed. Documentation inventory and historical-preservation checks and diff review were performed against the reviewed base; all 85 prior CHG entries are retained unchanged.
- Executed isolated local Guest browser journey: created two synthetic Moments/activities through existing forms, filtered by Moment, reloaded, opened the parent workspace, saved a linked expense in place, edited/completed an activity, and confirmed its notes, completion, filter selection and expense survived reload. Dashboard excluded the completed activity from Upcoming; Profile destinations were inspected. Dark 390px and light 320px views retained existing styling with no horizontal page overflow; corrected navigation fills four columns. Browser checks use local synthetic Guest records, not production account records.
- Source-derived: business records continue through existing services and remain within their original parent arrays; no global view metadata is persisted. Updated master, business guide and in-app About guidance. Unverified: live account writes, deployed security, native-device/PWA behavior and production publication. No commit, push or deployment is included; the version remains 1.0.23 until a separately authorized release.

## CHG-20261022-085 | Verify permanent production release 1.0.23
- Date: 2026-10-22. Implementation `f7915b689a8382b4e44fe3dfb8de7b426bcce1e0` pushed normally to OldVersion; main remains `a7f5c26d6e43a971b1461b101f8823129de12cf6`.
- GitHub Actions [run 39804298219](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39804298219) passed documentation-contract and application-smoke-tests. Official CLI `deploy --only hosting --project expense-tracker-divin --non-interactive` released 35 tested files to permanent live site `dn-10`, https://dn-10.web.app; no preview or database/Rules deployment.
- Executed HTTP read-back: all 35 files plus root/About routes returned 200 and matched tested SHA-256 bytes on the first attempt. Index: `7bfdcf5f461c097059df7951d263517c1588bcdc731a87ba09e4e0037aa7dda3`; worker: `a998cc55eb3f46fa171660cd326cd8e44bd8cc775effc72d14a648668e76eb62`.
- Executed signed-in production UI: About shows 1.0.23/Production; desktop direct bold editing produces formatted text and Preview displays it correctly. At 390px width and reduced 430px height, the long-note dialog kept its header, text area and footer within the visible screen with zero page scroll. Drafts were cancelled without saving business records. Proof screenshot remains outside tracked source.
- Status: COMPLETE — Git publication, permanent Hosting and production read-back verified. This evidence-only follow-up leaves application/build inputs unchanged. Native iPhone/PWA keyboard confirmation and the known warnings/formatting limits in CHG-083–084 remain outstanding; reduced-viewport checks do not prove native behaviour.

## CHG-20261022-084 | Correct mobile keyboard positioning and prepare release 1.0.23
- Date: 2026-10-22. Owner supplied the iPhone visibility screenshot and authorized completing both editor changes, normal OldVersion push and permanent Firebase deployment. Reviewed base `0e176f2405e6031872cd9adc4dc1699bc69ef771`; preserved the prior local desktop work in CHG-083. main is outside this change.
- Mobile: derive visible bounds from a stable layout reference rather than shrinking innerHeight alone; retain valid pan offsets, reconcile resize/scroll/focus events and reset the reference on width changes. Full-layout scrim uses visible insets to place the sheet, preserving coverage during focus movement. Reference-counted fixed-body locking preserves/restores inline styles, classes and page scroll. Focus restoration prevents extra page movement. Only while the keyboard is open, long textareas scroll within a bounded height; ordinary expansion returns on dismissal. Compact toolbar/layout are retained.
- Release includes the Word-style desktop editor from CHG-083, pinned packages, conversion/compatibility and validation tests. Updated master, business guide and About to the resulting behaviour; package/lock version 1.0.23. No synchronization redesign, account mutation, schema migration or Rules deployment.
- Executed final validation: `npm test` passed 207/207 with zero failures/skips; `npm run build` passed, 2464 modules. Existing >500 kB main-chunk warning remains (1089.31 kB); visual-editor code is a separate 418.28 kB chunk. The existing nine dependency advisories recorded in CHG-083 remain.
- Executed isolated guest checks at 320/390px and reduced 430px height: header, focused long text and footer remained within the visible screen with no horizontal overflow and 16px input text. Caret at the end of a 45-line note scrolled inside the field; page scroll stayed zero, scrim covered the full layout, normal textarea expansion returned after keyboard dismissal and closing restored the page lock. Both themes checked without saving drafts. New geometry tests cover shrinking both layout measurements with retained pan, focus/window scrolling, orientation and cleanup; six lock tests cover nesting and precise restoration.
- Evidence limit: reduced browser viewports and fixtures are not native iPhone/PWA keyboard confirmation. The source correction addresses the screenshot-consistent mechanisms; the owner's actual device still requires read-back. Source/local verification complete; remote CI and permanent deployment require their own verification after the implementation commit.

## CHG-20261022-083 | Prepare Word-style desktop note editing for review
- Date: 2026-10-22. Reviewed clean base `0e176f2405e6031872cd9adc4dc1699bc69ef771`, OldVersion; remote freshness checked. Owner clarified direct formatted typing like a word processor, retaining current mobile layout. Desktop work is prepared locally; no commit/push/publication is claimed here. The mobile keyboard-only report awaits the owner's screenshot and is unresolved.
- Above 1024px, lazily load pinned Tiptap 3.32.0 for direct formatted typing, text styles, active tools, single-level lists/quotes/code, undo/redo, word count and Edit/Preview, with wider writing dialogs. Through 1024px, retain the existing compact editor and its styles/handlers. Crossing the breakpoint keeps draft strings but resets caret/undo history.
- Compatibility: retain the existing string storage/backup format, untouched source blocks, whitespace/newlines and literal HTML text. Add combined bold/italic rendering support. Plain-text paste is one transaction, so rejected content cannot partly apply; required visual notes need actual text even when an empty block has formatting markers. Unsupported structures are rejected. Edited list syntax may normalize; literal Markdown-like punctuation and backticks retain the existing grammar's appearance limitations.
- Executed: `npm test` passed 199/199, zero failures/skips; `npm run build` passed, 2463 modules. Existing >500 kB main-chunk warning remains; desktop editor is a separate 418.28 kB chunk. Package audit reports nine advisories (3 moderate, 6 high) in existing Firebase/Router/build dependencies, with none reported against the added editor packages; no broad dependency remediation.
- Executed isolated guest browser checks: direct bold+italic, ordinary typing/time text, list continuation, quote/heading conversion, Undo, Edit/Preview caret return, save/reload/reopen without text changes, 1025px toolbar fit, both themes, and 390px compact editor retention with the same draft. Empty formatted required greeting was blocked and cancelled. Real Tiptap schema, adapter, paste/undo/rejection and required-text tests passed. No production account records or synchronization behaviour changed. Master/business guide updated; visual evidence saved outside tracked source.

## CHG-20261022-082 | Add owner-approved business guide as the fifth document
- Date: 2026-10-22. Reviewed base `17627ecd6a706bdb832c6b8d4c9ee3d04136223a`. Owner requested a strictly business-friendly overview and improvement checklist, with a focused review to conserve usage.
- Added `docs/DN_BUSINESS_GUIDE.md`: current features, everyday rules, limitations and explicitly proposed priorities. Master remains authoritative; no historical feature is treated as current merely because it appears in the log. No account-specific records are included.
- Updated AGENTS/README and coordinated the branding-test/CI inventory allowlists for exactly five documents. Preserved all prior history. Targeted branding/inventory tests passed 3/3; diff check passed. Application behaviour is unchanged, so no app rebuild or deployment is required for this documentation task. Initially prepared for review; the owner subsequently authorized committing the guide to Git.

## CHG-20261022-081 | Verify permanent production release 1.0.22
- Date: 2026-10-22. Implementation `4f7a4d3ce2367ded28d24c464379d3e4192f0d1f` pushed normally to OldVersion; main remains `a7f5c26d6e43a971b1461b101f8823129de12cf6`.
- GitHub Actions [run 39782170678](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39782170678) passed documentation-contract and application-smoke-tests; opt-in preview was skipped.
- Official CLI `deploy --only hosting --project expense-tracker-divin --non-interactive` successfully released the 33 tested files to permanent site `dn-10`, https://dn-10.web.app. No preview or database/Rules deployment.
- Executed read-back: all 33 files plus root/About routes returned HTTP 200 and matched tested SHA-256 bytes. One transport-closed asset request required a successful retry. Index: `16d4562a0cc67af84eff01982b20dd3810637e6d266cfea3b13408c2a9b75f07`; worker: `88f02cce5f03cc610ca2779c6c3dcd2ea64795e6f8819192db1baf429848d5cf`.
- Executed signed-in production UI: About shows 1.0.22/Production; 390px Moment form has one 50.8px toolbar row, 16px text and no dialog overflow. More reveals the secondary tools. Form cancelled without saving any business records; visual proof saved outside tracked source.
- Status: COMPLETE — publication/read-back verified. This evidence-only follow-up leaves application/build inputs identical to the implementation commit. Native iPhone keyboard/caret, large-bundle and synchronization limitations remain as recorded in CHG-080 and the master.

## CHG-20261022-080 | Compact mobile text editing and keep dialog controls reachable
- Date: 2026-10-22. Owner-requested mobile free-text refinement, continuing authorized OldVersion commit/push and permanent Firebase publication. Reviewed clean base `f9fb0ba7521073dc412d3498c5263b82b7e2a199`; release 1.0.22, without added dependencies.
- Shared editor: one mobile row for Bold/Italic/Bullets/More/Preview, optional secondary tools, 44px targets, shorter 96px initial writing area, growth and shrinkage with content, retained selection and Write/Preview caret return. Desktop retains all formatting tools. Stored strings, whitespace, note times and backup format are unchanged.
- Shared dialogs: header outside the sole scrolling body, visible-viewport geometry with resize/pan cleanup and pinch-zoom fallback, sticky mobile/short-screen form actions, muted close control and hidden-control focus filtering. Outer clipping prevents browser focus scrolling the header away. Source-derived keyboard adjustment reveals short fields above actions; long-text caret scrolling stays browser-managed.
- Executed local verification: `npm test` passed 185/185, zero failures/skips; `npm run build` passed, 2400 modules. Existing >500 kB chunk warning remains (main 1086.51 kB). Four real-editor handler tests and ten viewport geometry/observer tests cover selection, preview, resizing, keyboard geometry, zoom fallback, orientation, event coalescing and cleanup.
- Executed isolated guest browser checks: Moment, Transaction and Greeting Template forms; 320/390/430px widths, reduced 430px height, both themes and desktop 1280px. No inner field/dialog horizontal overflow; header and actions remained visible during focused lower-field editing. More expands/collapses, dropdown Escape retains the form, and 50-line notes grow then shrink to 96px. No production business records were changed.
- Documentation: master describes current interaction and test limits; four-document inventory retained. No synchronization redesign, data-model/storage/rules or account-record changes. Native iPhone Safari keyboard/caret behavior remains unverified; viewport emulation and fixtures are not device proof. GitHub CI and production publication require separate read-back after this commit.

## CHG-20261022-079 | Verify permanent production release 1.0.21
- Date: 2026-10-22. Implementation commit `10f009fd88af79177b742f7e941b1564d321eb09` pushed normally to OldVersion. main remains `a7f5c26d6e43a971b1461b101f8823129de12cf6`.
- GitHub Actions [run 39777276647](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39777276647) passed documentation-contract and application-smoke-tests. The preview workflow was skipped.
- Official CLI `deploy --only hosting --project expense-tracker-divin --non-interactive` successfully released 33 tested files to the permanent live site `dn-10`, https://dn-10.web.app. No preview, database or Rules deployment.
- Executed production read-back: all 33 files plus root/About SPA routes returned HTTP 200 and matched the tested SHA-256 bytes. Index: `ae23f41dcea11dda75118ee50b201b5f8be20fc2ab0c3a874e6e3d43310e2da4`; worker: `9fe4edcaa2970211ab1bd631950f777c4b0358fca862602c946967190200cfdf`.
- Executed signed-in UI: About shows v1.0.21/Production; activity Transaction opens in place with correct parent/activity/date; the responsive rich Activity editor is present. Both forms were cancelled without saving or changing production business records. Saved visual evidence remains outside tracked source.
- Status: COMPLETE — deployment and read-back verified. This follow-up records evidence only; application/build inputs remain those of the implementation commit. Existing large-chunk, native-device, mutation-failure and synchronization limits in CHG-078 remain.

## CHG-20261022-078 | Keep activity transactions in place, add rich notes and remember filters
- Date: 2026-10-22. Owner-authorized fixes, OldVersion commit/push and permanent production Hosting. Reviewed base: `35e5599259530811b66a9fe0a90134447e9521cc`; release version 1.0.21, without dependency additions or synchronization redesign.
- Activities: both Transaction entry points open the shared form inside the workspace, preset Moment/activity/date, retain the route on save/cancel/error, use the existing finance coordinator and guard repeated saves/closing during submission. Removed obsolete undefined Moment drawer resets.
- Notes: shared expanding editor and restricted safe rendering provide bold, italic, headings, lists, quotes, strikethrough, code and preview across supported note fields. Existing strings/whitespace, financial mirrors and JSON backups remain compatible; visible formatted phrases are searchable. HTML, links and images are literal text, not executable markup.
- Filters: shared styled dropdowns; account/guest-scoped browser memory for search/filter/sort, per-Moment activity choices and Quick Create type. Missing categories/months remain selected, Reset restores defaults/direction, storage failure keeps session memory, and Clear Local Data removes new/legacy filter keys. Old scoped transaction filters migrate; unowned global sort preferences intentionally start scoped defaults once.
- Documentation: master and About describe current behavior; retained the owner's proposed activity reminder enhancement without implementing it. No personal account notes or import records are captured here.
- Executed local verification: `npm test` passed 171/171; production build passed with 2398 modules. Existing >500 kB chunk warning remains. Isolated localhost guest journeys verified rich notes/HTML escaping, multiline formatting, 75-line editor growth at 320/390px with 16px text and no inner editor/page overflow, dropdown Escape/panel behavior in both themes, Moment/activity/Finance filter persistence and explicit Reset, and one linked expense saved/reloaded without leaving Activities. No production business data was changed by these code checks.
- Release target: project `expense-tracker-divin`, permanent live Hosting site `dn-10` (`https://dn-10.web.app`); deployment/remote CI require their own read-back. Native iPhone behavior, production save failures and cross-device synchronization are not proven by local/browser/mock checks.

## CHG-20261022-077 | Verify permanent production release 1.0.20
- Date: 2026-10-22. Source release: `3342eaf07b48f2f7040fd9b670b47f3114eb5c84`, pushed normally to OldVersion; main remained `a7f5c26d6e43a971b1461b101f8823129de12cf6`.
- GitHub Actions [run 39765691989](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39765691989) completed successfully: documentation-contract and application-smoke-tests passed. The opt-in preview workflow was skipped.
- Official CLI `deploy --only hosting --project expense-tracker-divin --non-interactive` released all 34 tested dist files to site `dn-10`, permanent live URL https://dn-10.web.app. No preview channel or database/rules deployment was used.
- Executed read-back: root, About deep link, worker and entry JavaScript returned HTTP 200 and matched tested SHA-256 bytes. Index: `0ac485db1c50d21a0f22dd98b46588a6d04bd8c58f3b5d9962da0508359e348c`; worker: `e81b0b544f30f9d1d0b2b3ba6f004b6f2c60c2a5db91ee6b552fe98094950fe7`.
- Executed production UI: About Refresh applied 1.0.20/Production; Finance displayed 40 transactions including the reported 20/115/50 expenses dated 22 October. Fresh production backup contained 36 unique expenses and four unique incomes, each target once and no runtime provenance. Add activity/Filters measured 44px with 13px/650 text; narrow 320px view had no page overflow. No production business records were saved or deleted.
- Read-back limitation reconciled in the master: root/deep-link HTML advertises `max-age=3600`; explicit index, worker and JS paths return no-cache headers. Cached clients may need About Refresh. Hosting configuration was not changed.
- Status: COMPLETE — production release and read-back verified. This follow-up changes documentation only; application/build inputs remain identical to the release commit. Item 3 remains unimplemented; mutation/security/native-device limits in CHG-076 still apply.

## CHG-20261022-076 | Recover transactions, compact Activity actions and reconcile documentation for 1.0.20
- Date: 2026-10-22. Owner-authorized scope: fixes 1–2, four-document refactor, CI-policy alignment, OldVersion commit/push and permanent production Hosting. Item 3 synchronization redesign is excluded.
- Source: inspected base `10639467750f55d62fcc4beabb22c695e9119432`; this implementation commit is identified by Git history. Package/lock version prepared as 1.0.20 without dependency changes. main is unchanged.
- Finance: read recognized income/expense records from `users/{uid}/transactions` alongside typed ledgers and nested expenses. Typed values win matching application IDs; runtime allowlisted provenance retains known copies for atomic same-kind updates/deletes, preventing resurrection after deletion/conversion. Actual document identity overrides stored routing metadata. New records remain typed; portable backups omit provenance. Persisted expenses tolerate missing old parents during deletion; guest/nested-only checks remain.
- Restore/UI: destination expense values and links govern added mirrors. Existing raw guest expense masters survive restore/retry and later parent removal; nested-only expenses are not promoted, and corrupt raw ledgers stop restore before writes. Add activity matches Filters at 44px with 13px/650 text in both themes.
- Documentation/CI: retained the four existing Markdown paths; master now has the requested 11 current-state sections, README contains commands/index and AGENTS contains concise update/evidence rules. Approximate routine intake fell 66% (characters/4 estimate). CI permits unchanged history and removes mandatory master/log diffs on every push; historical text/order, inventory and tests/build remain enforced. Review determines factual documentation impact. All 75 previous CHG entries remain intact.
- Final local verification: `npm test` PASS 151/151, zero failures; production `npm run build` PASS, 2393 modules, 1.0.20. The existing >500 kB chunk warning remains (main 1068.10 kB); the final suite emitted no HMR-port warning. Audit baseline/order checks and diff check passed. Current-document link/anchor and four-file checks passed.
- Executed journeys: read-only Firebase account view displayed 40 transactions including the three reported 22 October expenses; backup had 36 unique expenses and four incomes without routing metadata. Final-source isolated guest v3 restore/retry/export preserved IDs in all six domains (9 Moments, 76 Activities, 1 Memory, 2 attachment records, 36 Expenses, 4 Incomes), financial values/dates/links and original account data. Desktop and 320px/390px checks confirmed matching action heights with no page overflow. Synthetic actual-handler/service tests cover raw-master retention, parent removal, corrupt-ledger rejection, duplicate-source mutation failure and delete/conversion reloads. Production business mutations were not exercised.
- Useful history relocated from the former master: earlier sample stress rendered 672 transactions with about 102px minimum cards; v2 numeric-ID guest restore/retry retained totals 18000/1250/16750; About worker-wait source passed terminal/state-change/timeout/cleanup stubs. Earlier npm ci reported 9 advisories (3 moderate, 6 high), without remediation or fresh exploitability review. CHG-075 already records the prior 1.0.19 release.
- Limits: known-copy batches are atomic, but activity reconciliation, kind conversion and multi-record restore still use separate operations with attempted recovery. Optional legacy read denial can yield typed-only data. Native-device behavior, real account mutation/restore, deployed security rules and universal recovery remain unverified. No data-model migration, rules deployment, realtime listeners or offline queue were introduced.
- Status at implementation commit: source, documentation and local validation complete; GitHub checks and production publication follow the commit and are not claimed here. Their verified outcome will be recorded separately.

## CHG-20261022-075 | Restore Moment preferences and refine DN navigation for release 1.0.19
- Date (UTC): 2026-10-22.
- Requester: DN owner; all six current requests plus commit and Firebase publication.
- Branch / commit: OldVersion; the release commit is recorded in Git history. main is outside this release.
- Scope: Dashboard type visibility and Code Lists; external search beside one filter/sort control; list-only Moments; accurate About guide/build details; single-row workspace navigation; newest-first changelog/governance. This commit also includes the previously authorized, locally verified legacy finance/backup compatibility, scoped loading, upcoming-date, transaction-card and premium-button fixes already present in the working tree.
- Changed paths: AGENTS.md, README.md, docs/MASTER_SOURCE_OF_TRUTH.md, this changelog, .github/workflows/documentation-governance.yml, .gitignore, package.json/package-lock.json, scripts/audit-log.mjs/check-audit-log.mjs and tests; src/pages/{About,CodeLists,Events,Financials,Insights,Settings}.jsx, DashboardLayout.jsx, DashboardOverview.jsx, EventWorkspaceShell.jsx, TransactionHistory.jsx, ListControls.jsx/CSS, design-system.css, related finance/event/backup services and stores, and date/identity/visibility/navigation helpers with regression tests. Exact paths are in the commit diff.
- Result: Existing visibility flags become effective again; missing flags default visible. Search remains available beside Filters while secondary options expand. Moments use one list. Workspace sections stay in one row without resetting drafts or vertical scroll. About describes reachable features and attachment metadata limits. New log entries appear first and historical entry bodies are preserved.
- Data / compatibility: Stable identifiers and existing ledgers/guest-account boundaries retained. No destructive migration, database/rules deployment, or production business-data mutation is part of this release. Local verification screenshots remain ignored on disk.
- Verification: PASS: 143 Node tests and production build (2392 modules; existing large-chunk warning). PASS: local Dashboard visibility off/on, external search/filter rows, list-only Moments, five workspace tabs in one row at 320px, 390px and desktop, Activity query retention, Insights Clear and About 1.0.19/Refresh. PASS: local checker preserved 74 historical entries with one new entry first; 85 current-document links/anchors resolve; diff check, inventory and branding pass. PASS: read-only live Finance/About/workspace checks and HTTP index/worker byte comparison with 1.0.19. Existing account visibility flags were false and were not changed.
- Operations: Firebase Hosting release 1.0.19 completed for dn-10 in expense-tracker-divin. This source/test/documentation change set is the owner-requested OldVersion Git release; its final commit identity is recorded in Git history. main is outside the release push. GitHub Actions results and branch protection require separate read-back; local checks do not claim a remote CI pass.
- Limits: Native-device, real account restore/mutation, deployed rule security and complete recovery remain unverified. Existing dependency advisories and large-bundle warning are not remediated by these UI changes.

## CHG-20261022-074 | Scope base mobile Safari font regression test
- Date (UTC): 2026-10-22.
- Actor/requester: DN owner, closeout QA for remaining Greeting Template iPhone focus zoom.
- Branch / commit / PR: OldVersion only, SHA in Git history; main unchanged and no deployment.
- Exact paths: src/utils/premiumUxContract.test.mjs, docs/MASTER_SOURCE_OF_TRUTH.md, docs/CHANGE_AUDIT_LOG.md.
- Before -> after: v2.15.5 run 39709793563 passed 113/114 tests and failed one old assertion which counted every later 16px rule after the original global guard. Updated test to check the baseline CSS block only, leaving targeted 16px guard tests separate. No further CSS changes.
- Verification: npm test/build and documentation governance pending new CI. Actual iPhone Safari/keyboard zoom behavior NOT RUN.
- User/data/security impact: Source regression test and documentation only; no app runtime changes, deployment, schema or user data changes.
- Risk/rollback: Test change is scoped to CSS block boundaries; no runtime rollback required.
- Master: §9.1 and §13, v2.15.6.

## CHG-20261022-073 | Complete Safari form-focus zoom specificity audit
- Date (UTC): 2026-10-22.
- Actor/requester: DN owner, follow-up iPhone Safari focus zoom and closeout.
- Branch / commit / PR: `OldVersion` only, commit SHA in Git history. Protected `main` unchanged, no production deployment.
- Exact changed paths: `src/design-system.css`, `src/utils/premiumUxContract.test.mjs`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: v2.15.4 source contained a correct high-specificity 16px Moment Type Greeting Template override, but one older test incorrectly asserted the original global guard must be the very last stylesheet rule. CI 39709571162 passed the new Moment test and failed the stale earlier check. Fixed tests to assert precedence and coverage. Additional mobile 16px guards now cover high-specificity event search, activity search, Insights search, Code List add, Settings tag and activity Moment selector search inputs, whose font-size styles could bypass the prior global rule.
- Why: One consistent iOS Safari form-focus zoom prevention strategy, including actual styles responsible for magnification, without disabling manual zoom.
- User/data/security/compatibility impact: Input typography and source tests only; no data, Firestore schema, transaction flow, authentication or backups modified. Manual pinch-zoom and screen reader features remain available.
- Verification: GitHub Actions 39709571162 v2.15.4 tests 112 PASS/1 FAIL (obsolete assertion), build skipped, docs governance PASS. This new commit updates that test and adds coverage; `npm test`, `npm run build`, governance pending CI. Real iPhone/Android, large-text iOS accessibility and keyboard visual viewport NOT RUN.
- Risks/rollback: Longer search terms may wrap/truncate differently, but field width and height rules are retained; revert the commit if needed. No schema migration.
- Master sections updated: §9.1 and §13 to version 2.15.5.
- Status: SOURCE UPDATED / CI AND NATIVE DEVICE ACCEPTANCE PENDING.

## CHG-20261022-072 | Fix remaining iPhone Greeting Template input-focus magnification
- Date (UTC): 2026-10-22.
- Actor/requester: DN owner; supplied iPhone Safari screenshot of Code Lists > Moment Types > Greeting Template still zooming after v2.15.3.
- Branch / commit / PR: `OldVersion` only, commit SHA in history. `main` unchanged; no Vercel/Firebase deployment.
- Exact changed paths: `src/design-system.css`, `src/utils/premiumUxContract.test.mjs`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Shared mobile 16px editor CSS lost the specificity contest to `html[data-theme] .moment-type-form textarea` and `html[data-theme] .moment-type-form select`, which inherited the 14px `--font-body` token with `!important`. Final 16px mobile-specific selectors now override Moment Type input, select and textarea fields, and explicitly protect Settings Greeting textareas. No changes to label/button/preview typography or application logic.
- Why: iOS Safari commonly focuses/zooms editors displaying under 16 CSS pixels. Fixing the computed font size, not imposing an inaccessible viewport maximum-scale, addresses the actual root cause.
- User/data/security/compatibility impact: Style-only behavior, plus tests/docs. No transaction, Moment type value, greeting template data, Firestore/guest storage, security permissions, backups, or database changes. Manual browser zoom and accessibility scaling remain permitted.
- Verification (PASS/FAIL/NOT RUN): Added static regression tests for legacy-vs-final selector order, exact Moment editor coverage and no viewport scale restrictions. `npm test`, `npm run build`, governance CI PENDING. Native iPhone Safari and accessibility large-text focus, modal scroll and keyboard visual viewport NOT RUN.
- Risk and rollback: Underlying 14px desktop token remains, while editable field fonts increase to 16px on mobile; long Greeting Template contents may wrap differently. Revert this commit for rollback; no schema migration.
- Master sections updated: §9.1 and §13, version 2.15.4.
- Status: SOURCE IMPLEMENTED / CI AND NATIVE DEVICE ACCEPTANCE PENDING.
- Follow-ups: User to test Greeting Template and other Code Lists/modal textareas on updated preview, verify focus retains original Safari viewport scale.

## CHG-20261022-071 | Prevent iPhone Safari focus zoom on DN form inputs
- Date (UTC): 2026-10-22.
- Actor/requester: DN owner. Supplied iPhone Safari screenshot showing unwanted page magnification after tapping the Transaction form Title field.
- Branch / commit / PR: `OldVersion` only, commit SHA pending. Protected `main` unchanged; PR #6 unmerged; no deployment.
- Exact changed paths: `src/design-system.css`, `src/utils/premiumUxContract.test.mjs`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`. `index.html` inspected but intentionally unchanged.
- Before -> after: Existing mobile inputs inherited field fonts smaller than 16 CSS px in portions of the form system, triggering iOS Safari's focus-zoom. A final 16px CSS minimum covers editable inputs, textarea, selects, searchable dropdown fields and contenteditable regions at <=1024px. Excludes checkbox/radio/range/file/color/hidden and button-like controls. No forced scale reset, viewport restrictions, or disabled pinch zoom.
- Why: Prevent accidental magnification at focus rather than using unreliable JavaScript pinch reset or inaccessible user-scalable=no viewport policies.
- User/data/security/compatibility impact: Typography only, no persisted transaction data, Firebase rules, layout route changes, input validation, backup records or account/guest storage edits. Text may take more horizontal space and should be verified at narrow widths; manual browser zoom remains allowed.
- Verification (PASS/FAIL/NOT RUN): Added regression contracts for 16px floor on form editor types, exclusions, dropdown search and viewport zoom permission. `npm test`, `npm run build`, documentation governance pending GitHub CI. Actual iPhone Safari auto zoom, 320px portrait, keyboard visual viewport and browser history zoom NOT RUN.
- Risk and rollback: iOS may still zoom by user pinch or accessibility settings; CSS cannot guarantee no browser zoom from other triggers. Revert this commit to restore font sizing. No storage migration.
- Master sections updated: §9.1 and §13 to version 2.15.3.
- Status: SOURCE IMPLEMENTED / CI AND DEVICE QA PENDING.
- Follow-ups: Test focusing every Finance/Moment/Activity/Code List/Settings editor on an actual iPhone Safari viewport, including programmatic focus and searchable dropdown portals. Keep 16px rule last when consolidating legacy CSS.

## CHG-20261022-070 | Correct Finance density contract and panel-padding selector
- Date (UTC): 2026-10-22.
- Actor/requester: DN owner, continued compact Finance and Moment header pass.
- Branch / commit / PR: OldVersion only, commit SHA in Git history. Protected main unchanged and no deployment.
- Exact changed paths: src/design-system.css, src/utils/premiumUxContract.test.mjs, docs/MASTER_SOURCE_OF_TRUTH.md, docs/CHANGE_AUDIT_LOG.md.
- Before -> after: v2.15.1 GitHub Actions run 39707771777 failed 1/108 tests because an old source assertion required the full-length swipe hint; it now checks the approved short description. A CSS rule erroneously targeted a descendant .transactions-panel within .dn-transactions-page, rather than the single panel element that has both classes; it now applies 12px compact padding correctly.
- Why: Preserve the shorter Finance header and ensure removal of unnecessary padding is real, not a no-op.
- User/data/security/compatibility impact: CSS plus tests only, no records, Firebase schema, financial calculation, permissions or backups affected.
- Verification: Previous 2.15.1 CI 107 tests passed, 1 stale assertion failed; build skipped after test failure. New source regression test, npm test/build/docs checks PENDING GitHub Actions. Real mobile views NOT RUN.
- Risks and rollback: Panel padding on small screens may affect dense filters; verify on 320-430px viewport. Revert change to restore prior selector and assertions.
- Master sections updated: §9.1 and §13 to v2.15.2.
- Status: SOURCE CORRECTED / CI AND MOBILE QA PENDING.

## CHG-20261022-069 | Remove extra Finance and Moment hero whitespace
- Date (UTC): 2026-10-22.
- Actor/requester: DN owner; requested lightweight Income/Expense/Balance cards, Add Transaction and description on a single compact row, small top-right Memory/Greeting buttons inline with Moment type.
- Branch / commit / PR: `OldVersion` only, Git SHA pending, protected `main` unchanged, PR #6 unmerged; no deployment.
- Exact changed paths: `src/pages/Financials.jsx`, `src/components/financials/TransactionHistory.jsx`, `src/features/events/components/EventWorkspaceShell.jsx`, `src/design-system.css`, `src/utils/premiumUxContract.test.mjs`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Finance totals were high, padded cards with a redundant visible month period row; now three shallow low-shadow tiles remain in a single responsive line. Financial Transactions header previously held a long multi-line gesture explanation and CTA could wrap full width on mobile; now the heading/short one-line definition and CTA share a compact row, with small-screen truncation instead of wrap. Moment hero top-left type text previously began on a separate row below the oversized 48px Memory/Greeting utility area; now type and smaller 44px utility targets share a single row, hero inner spacing reduced and labels are retained except at <=360px.
- Why: Improve information density and mobile thumb reach without eliminating financial context or confusing the Moment hero hierarchy.
- User/data/security/compatibility impact: JSX/CSS/source regression tests only; totals remain based on selected month and existing account/guest stores; original transaction and Moment utility callbacks, swipe actions, Firestore/backup schema and linked activity data unchanged. Accessible summary and utility labels remain present.
- Verification: Added layout source-contract assertions; `npm test`, `npm run build` and governance checks PENDING GitHub CI. Real iPhone/Android viewport, zoom/accessibility, clipping and performance NOT RUN.
- Risk and rollback: Extra-long currency values may wrap within a shallow tile, while unbroken CTA/description prioritizes a single row. Tiny-width utility labels deliberately hide but retain aria-label. Rollback by reverting source commit; no data migration.
- Master sections updated: §9.1 and §13 to 2.15.1.
- Status: SOURCE IMPLEMENTED / CI AND DEVICE QA PENDING.
- Follow-ups: Verify Finance at 320/375/390/430px including long INR values and zoom; verify Moment type label and utility touch targets with long title, dark/light themes and screen readers.

## CHG-20261022-068 | Compact glass popup for both swipe directions
- Date (UTC): 2026-10-22.
- Actor/requester: DN owner. Replace large swipe action overlays with a lightweight glass dropdown; swipe either left or right to show the exact same available options, including Delete.
- Branch / commit / PR: `OldVersion` only; SHA in Git history. `main` unchanged, no deployment.
- Exact changed paths: `src/components/common/SwipeActionCard.jsx`, `src/utils/swipeMenuPlacement.js` (new), `src/utils/swipeMenuPlacement.test.mjs` (new), `src/utils/swipeGestures.test.mjs`, `src/utils/premiumUxContract.test.mjs`, `src/components/financials/TransactionHistory.jsx`, `src/pages/CodeLists.jsx`, `src/design-system.css`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Every shared swipe surface used a large full-card glass overlay and distinct left/right action content. Now left and right deliberately open the exact same small, glass-blurred portaled popup. The menu lists available commands, ending with a red Delete row where deletion exists; cards stay stationary and maintain their original layout. Menu width 188 CSS px, maximum height 244 CSS px with internal scrolling; viewport placement flips/clamps above/below, accounts for visualViewport offsets and mobile navigation clearance. Escape/outside tap/scroll/resize dismiss; keyboard arrow navigation supported.
- Why: Match owner's lighter mobile experience, avoid dominating the card, and eliminate the need to remember gesture direction.
- User/data/security/compatibility impact: UI and regression tests only; existing action callbacks, deletion confirmations, IDs, account/guest storage, linked transactions, Firebase collections, backups and permissions unchanged. Neither direction directly deletes records.
- Verification (PASS/FAIL/NOT RUN): Added geometry placement unit tests, mirrored swipe-threshold cases and source interaction contracts. `npm test`, `npm run build` and docs governance PENDING CI. Real iPhone Safari, Android Chrome, keyboard/VoiceOver/TalkBack, visual viewport/keyboard and measured 60fps NOT RUN. Native haptics unavailable in some browsers, including iOS Safari.
- Risk and rollback: Mobile safe-area/navigation clearance is estimated; final positioning and nested portal event propagation require device QA. Existing legacy tray CSS remains unused but is not deleted in this scoped change. Revert this commit to restore prior gesture UI; no schema rollback.
- Master sections updated: §9.1, §13, v2.15.0.
- Status: SOURCE IMPLEMENTED / CI AND MOBILE QA PENDING.

## CHG-20261022-067 | Protect nested card action clicks from swipe activation
- Date (UTC): 2026-10-22.
- Actor/requester: DN owner, premium swipe overhaul follow-up.
- Branch: OldVersion only; main unchanged; no deployment.
- Exact paths: src/components/common/SwipeActionCard.jsx, src/utils/premiumUxContract.test.mjs, docs/MASTER_SOURCE_OF_TRUTH.md, docs/CHANGE_AUDIT_LOG.md.
- Before -> after: Generic card click opened the left action tray even when nested buttons (Activity expense disclosure, Moment navigation) were used. Nested interactive elements now keep their actions, with an intentional tap-to-reveal exception for Code List rows.
- Verification: Previous 2.14.1 source passed 100/100 tests, Vite build and documentation governance in run 39705631114. This correction pending CI. Manual iPhone/Android and frame-time NOT RUN.
- Data/security impact: UI only, no schema, persisted data, Firebase rules or production deployment changes.
- Risk/rollback: Minor intentional restriction to tapping nested controls; revert this commit if needed.
- Master: §9.1 and §13, version 2.14.2.

## CHG-20261022-066 | Repair swipe keyboard test after shared component refactor
- Date (UTC): 2026-10-22.
- Actor/requester: DN owner; AI CI correction for premium mobile swipe overhaul.
- Branch: OldVersion only; main untouched; no deployment.
- Exact paths: src/utils/premiumUxContract.test.mjs, src/design-system.css, docs/MASTER_SOURCE_OF_TRUTH.md, docs/CHANGE_AUDIT_LOG.md.
- Before -> after: Previous CI run 39705456571 failed one stale source-test expectation for an onKeyDown handler that moved from TransactionHistory to shared SwipeActionCard. Test now verifies the shared handler. Other action tray overflow begins with Edit visible on narrow cells instead of using flex-end alignment.
- Reason: Prevent false source test failures while protecting keyboard support and the first-action affordance.
- Verification: CI pending on this commit; real iPhone and Android behavior not verified. No data or schema changes.
- Risk and rollback: Low presentation risk; if needed revert patch without data rollback.
- Master: §9.1 and §13, version 2.14.1.

## CHG-20261021-065 | Rebuild shared card gestures after iPhone screenshot defects
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner. Real iPhone Safari screenshots of Moment detail and Code Lists exposed nonworking cards, extra Delete row and tiny hero icons.
- Branch / commit / PR: `OldVersion` only; pending commit SHA. Protected `main` unchanged; no deployment requested/performed.
- Exact changed paths: `src/components/common/SwipeActionCard.jsx`, `src/components/events/ActivityList.jsx`, `src/components/financials/TransactionHistory.jsx`, `src/pages/CodeLists.jsx`, `src/features/events/components/EventWorkspaceShell.jsx`, `src/utils/swipeGestures.js`, `src/utils/swipeGestures.test.mjs`, `src/utils/premiumUxContract.test.mjs`, `src/design-system.css`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Separate swipe stacks and conflicting Code List slide/drop-down panels were used by different screens; now all major editable cards share a consistent Touch Events + Pointer Events gesture controller and a stationary glass overlay with visible 48px action buttons. Old Code List separate action divs no longer rendered. Moment header two top-right utility buttons display 21px Lucide icons and text in 48px minimum targets. Card grid/list layout structure retained. Left reveals contextual actions, right reveals Delete; no destructive swipe auto-execution.
- Why: Automated source tests had passed while actual UI was visibly broken. A common card primitive reduces drift and removes the conflicting sliding-row DOM layouts.
- User/data/security/compatibility impact: Presentation/event handling only; unchanged financial/guest/account storage and delete confirmation handlers, IDs and backup schema, no migration, Firebase rules change or hosting deployment.
- Verification: Added gesture direction and source-contract tests; `npm test`, `npm run build`, governance checks PENDING GitHub Actions. Real iPhone/Android/VoiceOver/TalkBack interactions, frame-time 60fps measurement and visual screenshot comparison NOT RUN on the new source.
- Risks and rollback: Short drag plus accidental tap behavior and horizontal scrolling of multi-action trays require mobile device testing. Underlying old style definitions remain but the final design system overrides the card surfaces. Revert commit on OldVersion to restore previous source; no database rollback.
- Master sections updated: §9.1 and §13 v2.14.0.
- Status: SOURCE CHANGES PENDING CI AND MOBILE ACCEPTANCE.
- Follow-ups: Compare screenshot at 375/390/414px, test iOS touch/vertical scroll, nested action buttons and no accidental activation, inspect both themes and long Moment names; verify live Firebase and security separately.

## CHG-20261021-064 | One-line financial totals and swipe reliability repair
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner, UI bug report.
- Branch: OldVersion only; main unaffected. No deployment or stored data changes.
- Paths: src/design-system.css, src/components/common/SwipeActionCard.jsx, src/components/financials/TransactionHistory.jsx, src/utils/premiumUxContract.test.mjs, docs/MASTER_SOURCE_OF_TRUTH.md, docs/CHANGE_AUDIT_LOG.md.
- Before -> after: Narrow Finance breakpoints split Balance onto a second row; now all three cards stay on one responsive row. Transaction drag-end referenced removed resolver causing runtime swipe failure; corrected. Moment swipe release uses pointer gesture intent rather than gesture-library drag tracking. Code List row transform disabled, actions animate on top of a stationary row.
- Validation: New source-contract tests; npm test/build and governance pending GitHub CI. Manual browser/swipe/performance QA not run.
- Risk/rollback: Very narrow widths may wrap currency figures; swipe click suppression and Code List overlay behavior need device review. Revert this commit to roll back. No migration.
- Master: §9.1 and §13, version 2.13.1.

## CHG-20261021-063 | Consistent left-other/right-Delete gestures and clean Moments list
- Date (UTC): 2026-10-21.
- Owner request: no card three-dot menus, right swipe reveals Delete, left swipe reveals other actions; remove Moment List timeline line/dots, retain Grid.
- Branch: OldVersion only. main unchanged. No deployment or database/schema writes.
- Paths: src/pages/Events.jsx, src/features/events/components/EventWorkspaceShell.jsx, src/components/common/SwipeActionCard.jsx, src/components/financials/TransactionHistory.jsx, src/components/events/ActivityList.jsx, src/pages/CodeLists.jsx, src/hooks/useSwipeActions.js, src/utils/swipeGestures.js, src/utils/swipeGestures.test.mjs, src/utils/premiumUxContract.test.mjs, src/design-system.css, docs/MASTER_SOURCE_OF_TRUTH.md, docs/CHANGE_AUDIT_LOG.md.
- Before/after: Moments overflow replaced with gesture trays on list and detail hero; Finance, Activities, Code Lists use left contextual/right Delete reveal; decorative list rail/dots removed while Grid untouched.
- Safety: Swipe never directly deletes. Existing confirmation callbacks retained. No storage or Firebase changes; native haptics optional.
- Verification: Node tests, build, governance PENDING GitHub Actions. Real-device, iOS Safari, accessibility and measured FPS NOT RUN.
- Risk: Narrow Grid card tray may need horizontal scrolling/device QA; legacy CSS specificity requires later cleanup. Rollback by reverting this commit.
- Master sections: §9.1 and §13, version 2.13.0.

## CHG-20261021-062 | Verify final Finance Moment-link CI and build
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner; AI verification closeout for the restored Finance totals, Moment-linked transaction dropdown and premium UX safeguards.
- Branch / commit / PR: `OldVersion` only; documentation commit SHA in Git history. Verified application code commit `9ff53068e213e52e97e84e05ee1193258a33f3b3`. `main` untouched; PR #6 not merged.
- Exact paths: `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md` only.
- Before -> after: Prior source entry 061 documented two new regression cases with CI pending. GitHub Actions run https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39664033801 succeeded on exact source SHA `9ff53068e213e52e97e84e05ee1193258a33f3b3`, confirming that transaction Moment-only card, deletion safeguard, related helper tests and existing UI contract compile and pass automated checks.
- Why: Preserve verifiable implementation outcomes, avoid confusing pending source tests with actual pass/fail status, and maintain canonical documentation governance.
- User/data/security/compatibility impact: Documentation only, no account/guest data edits, Firestore mutation, migrations, rules change or deployment.
- Verification (exact commands, PASS/FAIL/NOT RUN): CI `npm test` **99 passed, 0 failed**; Vite `npm run build` **PASS**; documentation-contract checks **PASS**, all recorded in run 39664033801. Earlier run 39663726896 passed 97/97 after initial 2.12.0. Manual real-browser/mobile, accessibility, native haptics, 60fps performance, live Firebase accounts/guest and Security Rules tests NOT RUN. Nine known npm vulnerabilities and chunk-size advisory remain.
- Risk and rollback: No runtime impact for this documentation update; CI does not certify mobile polish or data/security in deployment. Any correction must append a new audit entry rather than rewriting historic entries.
- Master sections updated: §9.1 and §13, version 2.12.2.
- Status: AUTOMATED CI VERIFIED; MANUAL DEVICE/PRODUCTION QA OPEN.
- Follow-ups: Test transaction Moment→Activity cascade on device with long lists and imported stale links, confirm wallet summary responsive layout, check production Firestore rules and performance separately.

## CHG-20261021-061 | Verify Finance totals/picker CI and safeguard Moment-only cards/deletion
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner, transaction Moment linkage and premium Finance refinements.
- Branch / commit / PR: `OldVersion` only; SHA pending Git commit. Prior code SHA `cee0baf523f4c9152f4e3aead052e65790763868` verified in GitHub Actions run 39663726896. Protected `main` unchanged and no deployment.
- Exact changed paths: `src/components/financials/TransactionHistory.jsx`, `src/hooks/useTransactionManager.js`, `src/utils/premiumUxContract.test.mjs`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Moment-only transactions saved valid `eventId` data but their card showed no link without an activity; now shows a Moment line even without Activity, with unavailable fallback for historical deleted Moments. Expense deletion had always called `requireLinkedActivity` and thus blocked a Moment-only expense when that Moment was removed; now strict relationship validation is only required when an activity mirror may exist. Activity-linked deletion safety remains unchanged.
- Why: Keep Moment-only linked records discoverable and avoid unremovable historical transactions while retaining safeguards against orphan nested child expenses.
- User/data/security/compatibility impact: Display and conditional validation only. Existing `eventId` and `activityId` keys, Firestore/guest ledger paths, delete confirmation, backups and record IDs unchanged; no migration or production deployment.
- Verification (exact commands, PASS/FAIL/NOT RUN): Preceding commit `cee0baf523f4c9152f4e3aead052e65790763868` GitHub Actions [39663726896](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39663726896) `npm test` **97/97 PASS**, `npm run build` PASS, documentation governance PASS. New two source-contract tests, build/audit for this commit PENDING CI. Native browser/mobile, guest/account live roundtrip, 60fps profiling, accessibility and Firestore Security Rules NOT RUN. Nine dependency advisories and bundle size warning persist.
- Risk and rollback: Parent Moment deletion while financial activity links remain is still intentionally blocked to avoid reappearing nested expenses. Source tests verify structure, not end-to-end Firebase requests. Revert this commit to roll back.
- Master sections updated: §9.1 and §13 version 2.12.1.
- Status: SOURCE IMPLEMENTED / CI PENDING; PRIOR CI VERIFIED.
- Follow-ups: Test moment-only create/edit/delete when the Moment is missing, prior activity links with deleted children, card wrapping and keyboard gestures on small viewports.

## CHG-20261021-060 | Restore financial totals and Moment-first linked transactions
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner; requested top Income/Expense/Balance totals without Overview and shorter activity dropdown scoped to selected Moment, while retaining premium UX direction.
- Branch / commit / PR: `OldVersion` only; pending Git commit SHA, PR #6 untouched; protected `main` unchanged.
- Exact changed paths: `src/pages/Financials.jsx`, `src/components/financials/TransactionForm.jsx`, `src/utils/transactionRelations.js`, `src/utils/transactionRelations.test.mjs`, `src/utils/premiumUxContract.test.mjs`, `src/design-system.css`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Finance's Transactions-only layout omitted top totals. Now three responsive, theme-token Income/Expense/Balance cards display month-scoped totals independently of type/search, with no Overview tab. Transaction forms formerly flattened every Moment's activities into a very long picker; now optional Moment selects first and only its activities appear in the second picker. On switching Moments, stale activity selection clears. Existing edit/deep-link selections hydrate both fields. Moment-only links supported with explicit validation; broken historical link placeholders remain visible for review rather than silently losing data.
- Why: Restore at-a-glance finances without duplicative navigation, reduce activity picker cognitive load, preserve safe event/activity relationships on edit and type changes.
- User/data/security/compatibility impact: Presentation + link validation only; existing `eventId`/`activityId` record keys and Firestore/guest storage unchanged; no migration or deletion. A valid Moment-only expense does not create an activity expense mirror, while unlinking a historical activity removes its nested mirror through existing reconciliation. Invalid stale links continue to produce user-facing errors; no cross-user access changes.
- Verification (exact commands, PASS/FAIL/NOT RUN): Added updated Node validation tests, derived Moment filter tests, moment-only expense reconciliation test and source-contract coverage for cards/form. `npm test` / `npm run build` / audit governance PENDING GitHub CI. Live iOS/Android, screenshot/safe-area, 60fps gesture measurement, Firebase account/guest create/edit/restore and Security Rules NOT RUN.
- Risk and rollback: Moment-only links are now allowed by the unified form and validator (intentional owner request), but only activity-linked expenses are mirrored into activities. Read-only source/Node tests cannot guarantee native calendar controls stay inside every mobile viewport. Revert the commit for rollback; no schema or stored-data migration.
- Master sections updated: §9.1, §9.2, §13 version 2.12.0.
- Status: SOURCE IMPLEMENTED / CI AND DEVICE QA PENDING.
- Follow-ups: Verify link selection and activity resets for both account/guest, invalid deep links, old imported transactions, scroll and popover placement with keyboard, 320-430px cards, and backend security rules.

## CHG-20261021-059 | Confirm premium Finance single-screen UX regression CI
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner; completed source QA confirmation for Transactions-only, no swipe three-dot and cross-module swipe consistency.
- Branch / commit / PR: `OldVersion` only. Verified app commit `4dbc5c92e29ad76fddd91884674a82951fb51af6`, GitHub Actions https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39662531768. This documentation commit SHA in Git history. `main` unchanged and no deployment.
- Exact changed paths: `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md` only.
- Before -> after: Previous audit entry 058 truthfully recorded four UX source contract regressions and Finance loading-error change as CI pending. Automated CI now confirms these passed without errors, along with all existing tests and production compilation.
- Why: Preserve a verifiable record of completion rather than leaving the latest implemented UX contract undocumented as pending.
- User/data/security/compatibility impact: Documentation-only; no database or storage changes, permissions, app runtime edits, device deployments or backups.
- Verification (exact commands, PASS/FAIL/NOT RUN): GitHub Actions `npm test` **92/92 PASS**, `npm run build` **PASS**, documentation governance **PASS** at source SHA `4dbc5c92e29ad76fddd91884674a82951fb51af6`. Physical-device scroll, animation frame-time, 200% zoom, VoiceOver/TalkBack, native calendar, browser keyboard and actual Firebase account operations NOT RUN. Known 9 npm advisories (3 moderate, 6 high) and bundle warning remain.
- Risk and rollback: Source CI does not prove production-grade polish or backend data security. No runtime change to roll back; append future corrections instead of modifying the audit history.
- Master sections updated: §9.1 and §13, version 2.11.3.
- Status: AUTOMATED SOURCE CI VERIFIED / MANUAL DEVICE AND PRODUCTION ACCEPTANCE OPEN.
- Follow-ups: Browser-screen and mobile-gesture acceptance, CSS cascade deduplication, accessible controls and overlay/keyboard/safe-area checks, deployment credential/security review if authorized.

## CHG-20261021-058 | Verify premium finance/swipe CI and lock simplified UX contract
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner; AI follow-up to the Finance Overview and three-dot removal plus premium interaction work.
- Branch / commit / PR: `OldVersion` only, pending commit SHA. Verified source commits `b64078cf11dc09cb653354e175f6cd6ee61c76fe` and `97bc91c1fee8392d19462c137aac70f7cc4b2401`. `main` not modified; PR #6 not merged.
- Exact changed paths: `src/pages/Financials.jsx`, `src/utils/premiumUxContract.test.mjs`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: When either financial dataset failed to load, Transactions could continue displaying loading skeleton alongside its Retry error. Now an error suppresses the pending skeleton. Four Node source-regression tests guard the Transactions-only Finance view, bookmarked routes, Edit/Delete swipe and keyboard affordance, absence of transaction overflow dots, continued Events overflow actions, and same-direction Activities/Code Lists trays.
- Why: Make a visible load failure unambiguous, and prevent future source edits silently restoring redundant Overview navigation or hidden opposite-direction Delete.
- User/data/security/compatibility impact: Presentation and regression tests only. No persisted record edits, Firestore Rules changes, data migration or Firebase Hosting deployment.
- Verification (exact commands, PASS/FAIL/NOT RUN): GitHub Actions run 39661553142: `npm test` 87/87 PASS, `npm run build` PASS, documentation checks PASS. GitHub Actions run 39662186586: `npm test` 88/88 PASS, `npm run build` PASS, documentation checks PASS. New four source-contract tests and loading skeleton change: PENDING CI. Real phone screen/gesture/frame-rate, live Firebase and Security Rules NOT RUN. Existing npm advisory count: 9 (3 moderate, 6 high); bundle-size warning remains.
- Risk and rollback: New tests inspect source contracts rather than a rendered browser, so they may need updating when architecture changes legitimately. Suppressing a skeleton on failed load does not discard stored records. Revert this commit for rollback.
- Master sections updated: §9.1 and §13, version 2.11.2.
- Status: PRIOR SOURCE CI VERIFIED / CURRENT PATCH CI PENDING.
- Follow-ups: Run browser/mobile viewport regression, keyboard/screen-reader acceptance, fix CSS cascade duplication and inspect current production data-security rules.

## CHG-20261021-057 | Unify left-swipe edit/delete for Activities and Code Lists
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner, premium swipe consistency follow-up.
- Branch / commit / PR: `OldVersion` only; SHA pending Git commit. `main` unchanged.
- Exact changed paths: `src/utils/swipeGestures.js`, `src/utils/swipeGestures.test.mjs`, `src/hooks/useSwipeActions.js`, `src/components/events/ActivityList.jsx`, `src/pages/CodeLists.jsx`, `src/design-system.css`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Activities and Code Lists used split left-for-other/right-for-delete gestures, inconsistent with Transactions. Now all expose their non-destructive action tray via a deliberate left swipe; both Edit and Delete exist in the same revealed tray with original extra actions retained. Right swipes dismiss rather than expose destructive actions. Code Lists' variable-width action geometry and activity card tray follow shared swipe intent/44px targets, glass treatment and safe motion fallback.
- Why: Consistent thumb interaction reduces the chance of unexpected destructive affordances and avoids hidden opposite-direction gestures.
- User/data/security/compatibility impact: Existing action callbacks, delete confirmation, status deactivation validation, transaction linking, event/activity storage and Firestore paths unchanged. No data migration or deployment. Swipe itself never invokes Delete.
- Verification: Added Node swipe direction test; updated existing direction test. `npm test`, `npm run build` and documentation checks PENDING GitHub Actions. Browser vertical scrolling, haptics, 320px geometry, hover, screen readers and performance NOT RUN. Haptics are optional, not supported on all iOS browsers.
- Risk and rollback: Tray widths on narrow screens need on-device review; source retains older unused swipe CSS until a broader style deduplication. Revert this commit if interactions regress.
- Master sections updated: §9.1, §13, version 2.11.1.
- Status: SOURCE IMPLEMENTED / CI AND MOBILE QA PENDING.
- Follow-ups: Check real touch/keyboard interactions, archive of CSS specificity conflicts and actual 60fps frame-time profiling.

## CHG-20261021-056 | Transactions-only Finance and premium gesture interaction pass
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner; explicitly removed Finance Overview and transaction three-dot swipe trigger; requested full-system premium UX audit and polish.
- Branch / commit / PR: `OldVersion` only; pending Git SHA. Protected `main` and existing PR #6 untouched.
- Exact changed paths: `src/pages/Financials.jsx`, `src/components/financials/TransactionHistory.jsx`, `src/utils/swipeGestures.js`, `src/utils/swipeGestures.test.mjs`, `src/design-system.css`, `src/components/common/ModalDialog.jsx`, `src/components/events/EventActionMenu.jsx`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Finance displayed two tabs with standalone Overview summary/recent cards; now directly displays one Transactions list, filters and Add Transaction with both old routes preserved. Transaction cards had an overflow three-dot action trigger; now Edit/Delete are accessible through deliberate left swipe or keyboard Enter/Space on the card, with optional supported touch haptic and reduced-motion spring fallback. Events keeps its separate 3-dot action menu. Shared buttons gain standardized 44px minimum, gradient-primary/outlined-glass-secondary/danger hierarchy; modal close uses Lucide X and reduced-motion transitions; event action-menu placement callback tracks dynamic Summary presence.
- Why: Reduce redundant navigation and detached card controls, prevent accidental gesture triggers, and create a consistent premium interaction language without rewriting data architecture.
- User/data/security/compatibility impact: No database schema, collection path, backup, account identity, stored transaction or Firebase deployment changes. Historical /financials and /financials/transactions entry URLs remain valid; old income/expense deep links still redirect. Swipe actions never directly delete, confirmation required. Native mobile haptics and calendar placement depend on browser/OS support.
- Verification: Added two data-only swipe intent tests for slow moves, fast flicks and right-swipe dismissal. `npm test`, `npm run build`, documentation checks: PENDING GitHub Actions. Mobile iOS/Android, VoiceOver/TalkBack, browser focus trapping, screenshot review and 60fps profiling NOT RUN. Real Firebase data flows not exercised. Nine npm dependency advisories known previously.
- Full-system source audit: Dashboard, Events, Activities, Financials, Timeline, Memories, Settings, Modals, Forms, Empty states, Search/Filters and Navigation reviewed at source/style-contract level only. Existing Events menu and smart portaled dropdowns already present; remaining CSS cascade conflicts in `src/index.css` vs `src/design-system.css`, native date picker viewport behavior and mobile keyboard/safe-area render QA require browser testing. Lucide dominates current shared UI; remaining literal glyphs and inconsistent embedded button sizes need gradual cleanup. Card transform motion is optimized in principle but not performance measured.
- Risk and rollback: Removing Overview eliminates its dedicated financial summary view (intentional user decision); other Insights summaries retained. Keyboard article Enter/Space must be tested with screen readers. Existing app-wide CSS specificity may override some tokens in narrow layouts. Revert this commit on `OldVersion` if regressions occur; no storage rollback needed.
- Master sections updated: §§2,3.1a,9.1,9.2,13 to version 2.11.0.
- Status: SOURCE IMPLEMENTED / CI AND REAL-DEVICE QA PENDING.
- Follow-ups: Inspect screenshots at 320/375/390/430/768/1024px and 200% zoom; verify gesture vs vertical scrolling, safe area/keyboard, modal/dropdown collision, real iOS haptic limitation, accessibility, cross-theme shadows and actual frame-time. Resolve CSS duplication, security rules, data integrity and dependency advisories separately.

## CHG-20261021-055 | Record passing account-switch isolation CI
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner; AI CI follow-up for Financials regression prevention.
- Branch / commit / PR: `OldVersion` only; documentation commit SHA in Git history. Verified code commit `2a4433a6bf2cce1657cf05627bf93199aec7bba9`; `main` unchanged, no PR merged.
- Scope and changed paths: `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md` only; no application, Firebase or business-data writes.
- Before -> after: CHG-20261021-054 correctly recorded source-level scope isolation while automated CI was pending; now confirmed GitHub Actions run https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39659935648 completed successfully on that exact code SHA.
- Why: Keep the canonical source of truth and immutable-style audit evidence aligned with completed verification.
- User/data/security/compatibility impact: Documentation only. No data changes, deployments, new schema, or permission modifications.
- Verification (exact commands, PASS/FAIL/NOT RUN): GitHub CI `npm test` PASS **85/85, zero failed**; `npm run build` PASS; mandatory documentation contract PASS. Run 39659935648 completed `success`. Real devices, overlapping live Firebase account switches, Firestore Security Rules, backup integration NOT RUN. Nine npm advisories (3 moderate, 6 high) were reported.
- Risk and rollback: No runtime change. Revert this documentation commit if the verification evidence is superseded, preserving the audit append-only convention with a correction rather than deleting history.
- Master sections updated: §9.1, §13, v2.10.8.
- Status: VERIFIED AUTOMATED CI; LIVE QA STILL OPEN.
- Follow-ups: Verify account/guest and A → B → A request overlap in a browser, plus live activity transaction edits/deletes and security rules.

## CHG-20261021-054 | Isolate income and expense caches on account switches
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner; continued financial reliability work in the new chat.
- Branch / commit / PR: `OldVersion` only; pending commit (Git history will identify SHA). `main` untouched, PR #6 not merged.
- Scope and changed paths: `src/store/useIncomeStore.js`, `src/store/useExpenseStore.js`, `src/utils/financialLoadScope.js`, `src/utils/financialLoadScope.test.mjs`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Income cleared stale visible records on a scope change but retained old `loadedFor`; Expense did not clear old records at all. Both could incorrectly treat an old scope as cached after A → B → A navigation while requests overlapped; joining an in-flight request did not reactivate its scope. Both stores now clear scoped projections and `loadedFor` together on ownership change, check both keys before reusing cache, and reactivate pending loads before awaiting them.
- Why: Prevent cross-account/guest stale financial data from leaking into non-Financials screens or leaving an empty/stale transaction list after rapid session changes.
- User/data/security/compatibility impact: Client in-memory state only. Existing account Firestore paths, guest storage keys, transaction IDs and backup schema are unchanged; no data migration/deletion/deployment. This is defense in depth, not a substitute for server-side Firestore Security Rules.
- Verification (exact commands, PASS/FAIL/NOT RUN): Added six pure Node regression cases (`src/utils/financialLoadScope.test.mjs`); `npm test` and `npm run build` PENDING GitHub Actions; multi-account mobile browsers, overlapping live Firebase requests and Firestore Security Rules NOT RUN.
- Risk and rollback: Scope changes may temporarily show loading/empty lists until the selected account is fetched, intentionally avoiding previous-owner projection. Concurrent writes and live-account integration still need review. Revert this commit to roll back.
- Master sections updated: §9.1, §13, version 2.10.7.
- Status: SOURCE IMPLEMENTED / CI AND DEVICE QA PENDING.
- Follow-ups: Verify A → B → A switching with slow requests and account/guest/fixture modes; validate backup restore, expense edits and deployed rules.

## CHG-20261021-053 | Preserve complete transaction metadata in activity expense mirrors
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner, continued unified Transactions accuracy and premium UX.
- Branch/commit: `OldVersion` only, Git SHA in history; `main` unchanged.
- Paths: `src/utils/transactionRelations.js`, `src/utils/transactionRelations.test.mjs`, `src/services/eventService.js`, Master and audit.
- Before -> after: Event normalization removed nested expenses' title, category, notes and source, even when transaction reconciliation supplied some of them. A shared `normalizeActivityExpense` now preserves these metadata fields, stable identifier, dates, amounts and event/activity links, and handles legacy partial child records without inventing duplicate master entries.
- Why: Prevent linked transaction cards and activity histories losing user-entered context on event edits.
- User/data/security impact: Existing eventGroups and account/guest collection paths unchanged; new mirror objects include backward-compatible optional metadata. No data migration, deletion or Firebase deployment.
- Verification: Added two pure Node regression tests, CI Node/Vite build PENDING; real guest/account edit and restore on devices NOT RUN.
- Risks and rollback: Persisted eventGroups may be larger by small metadata values; backend rules/quotas and cloud concurrency require live testing. Revert commit to restore previous normalizer.
- Master: §9.1 and §13, v2.10.6.
- Status: SOURCE IMPLEMENTED / CI PENDING.

## CHG-20261021-052 | Preserve Financials scope when patching nested activity expenses
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner; continued financial simplification reliability pass.
- Branch/commit: `OldVersion` only; SHA recorded in Git commit. `main` unchanged.
- Exact paths: `src/store/useExpenseStore.js`, `src/hooks/useTransactionManager.js`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Nested-only expense editing, type conversion, and deletion called `setExpenses` that reset loadedFor/activeLoadKey. Financials then hid ALL ledger items because owner-scoped loads appeared invalid. Added `patchLoadedExpenses` that updates only the list and status without invalidating user-scoped load tracking; retained `setExpenses` for full restores.
- Why: Keep the unified Transactions screen stable after activity-linked mutations without bypassing owner isolation.
- User/data/security/compatibility impact: State-cache coordination only; no Firestore schema, business data, guest keys or backup changes. Scope-switch logic remains intact.
- Verification: Code inspection performed. GitHub application Node unit tests and Vite production build: PENDING CI. Browser guest/cloud transaction mutation tests: NOT RUN. No deployment.
- Risk/rollback: Concurrent cloud writes still non-atomic and require live integration testing. Revert this commit to restore previous state behavior.
- Master sections: §9.1 and §13, 2.10.5.
- Status: SOURCE IMPLEMENTED / CI PENDING.
- Follow-ups: Exercise nested-only create/edit/delete, type conversion, account switch and backup restore on devices.

## CHG-20261021-051 | Fix missing-ID financial collisions and guest nested projection persistence
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner, continued Financials implementation and safety review.
- Branch / commit / PR: `OldVersion`, Git SHA in history; `main` untouched.
- Scope: `src/utils/transactionRelations.js`, its Node tests, `src/services/incomeService.js`, `src/services/expenseService.js`, `src/store/useIncomeStore.js`, `src/store/useExpenseStore.js`, master and audit.
- Before -> after: Missing `firestoreId` values could be compared as equal, causing an edit to target an unrelated ledger row. Guest expense updates/deletes operated on merged master+nested histories, persisting activity-only expenses as new master rows. Now matching requires real equal IDs; shared immutable upsert preserves unrelated rows; guest writes target master records only and continue showing legacy nested history.
- Why: Prevent incorrect balances, stale activity expenses and guest data contamination.
- User/data/security/compatibility: No data migration, deletion, schema change or Firebase deployment. Existing guest keys and restored data remain readable, and prior duplicates are not automatically removed.
- Verification: Pure Node test added, CI Node/Vite run PENDING; real Firebase, guest browser, backup/restore and device QA NOT RUN.
- Risk/rollback: Existing contaminated ledgers may contain historical duplicates, which need owner-reviewed reconciliation; cross-record event writes remain non-atomic. Revert the code commit to roll back.
- Master: §§9.1,13, v2.10.4.
- Status: SOURCE IMPLEMENTED / CI PENDING.
- Follow-ups: Test multiple guest incomes, nested-only records, account scoped updates and backup restore.

## CHG-20261021-050 | Record completed premium UX implementation CI and remaining release blockers
- Date (UTC): 2026-10-21.
- Requester/actor: DN owner premium UX follow-up; AI verified connected GitHub Actions output.
- Branch: `OldVersion` only. Verified app commit `c22b3ddf87afb964e4a72004647306bc6f6d8e05`, run https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39656612559. This documentation-only commit separately identifies itself in Git history. `main` untouched.
- Paths: `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`. No changes to app code or data in this audit follow-up.
- Before -> after: Source changes through CHG-20261021-049 were CI pending -> verified `npm test` 76/76 pass, production Vite build pass and documentation-contract/four-file-only checks pass on committed source. The old separate Income/Expense page and form modules are absent on OldVersion, with routes redirected.
- Verification provenance: Job `application-smoke-tests` and `documentation-contract` on run 39656612559 both success, unit count confirmed in job logs. Device-browser rendering, gestures, 60fps and iOS haptics: NOT TESTED. Live Firebase Auth/Firestore integration, multi-record fault injection, real backup recovery and Hosting preview: NOT TESTED.
- Known risks: Non-atomic cross-collection activity ledger writes with best-effort compensation; remaining 9 npm advisories (3 moderate, 6 high); Vite large-chunk warning; real-device dropdown and calendar UX; Firebase Hosting service-account unavailable. Never represent production readiness or 60fps as verified.
- Rollback: Use prior Git commits on OldVersion; no DB migration was performed. This documentation-only change has no runtime effects.
- Master: §9.1b, §13, version 2.10.3.
- Status: SOURCE CI VERIFIED, PRODUCTION/DEVICE ACCEPTANCE NOT COMPLETE.

## CHG-20261021-049 | Route Link Existing Expense through unified transaction coordinator
- Date (UTC): 2026-10-21.
- Branch: `OldVersion` only; `main` unchanged. SHA available in Git history.
- Paths: `src/features/events/components/EventWorkspaceShell.jsx`, Master Source of Truth, append-only audit.
- Before -> after: Event workspace linked existing expenses with a direct expense update, leaving its nested activity record unsynchronized. Now `saveTransaction` receives an expense-type payload and original existing record, validating activity existence, updating master expense, and reconciling nested activity expense copy through the unified coordinator. Existing Link Expense workflow and existing transaction ID preserved.
- Data/security impact: No database collection/schema migration, no new separate form, no permission elevation. Multi-document Firestore operations remain non-atomic and best-effort compensating rollback has limitations.
- Verification: Source reviewed; CI Node tests and Vite build pending this commit; real guest/account Firebase linking and concurrency not tested.
- Risk/rollback: Network failure during either write may still require manual reconciliation; application surfaces error and retains modal; revert commit if needed.
- Master: §9.1, version 2.10.2.
- Status: SOURCE IMPLEMENTED / LIVE FIREBASE QA PENDING.

## CHG-20261021-048 | Improve partial-write recovery for financial activity links
- Date (UTC): 2026-10-21.
- Branch: `OldVersion` only; main unchanged.
- Paths: `src/hooks/useTransactionManager.js`, `src/utils/transactionRelations.test.mjs`, master and audit.
- Before -> after: If a type conversion failed after changing an activity mirror, rollback removed the replacement ledger record but could leave nested expense records missing or duplicated. Added best-effort inverse mirror reconciliation before deleting replacement. Same-type expense edits now attempt to restore the previous ledger record if activity mirror persistence fails. Errors remain visible and require inspection if compensation fails.
- Data/compatibility: No destructive data migration or schema changes. This reduces inconsistent multi-record writes but is NOT atomic across Firestore collections; live fault-injection and concurrency tests remain required.
- Verification: Added pure regression for a failed expense-to-income conversion and mirror restoration. CI build/Node tests pending.
- Risk/rollback: Compensation is best-effort and errors may still require manual reconciliation. Revert commit if regression detected.
- Master: §9.1, version 2.10.1.
- Status: SOURCE IMPLEMENTED, CI AND FIREBASE INTEGRATION PENDING.

## CHG-20261021-047 | Cross-application premium UX source audit and release acceptance matrix
- Date (UTC): 2026-10-21.
- Requester: DN owner, premium UI/UX redesign implementation brief.
- Branch/commit: `OldVersion`, this documentation commit SHA in Git history; `main` untouched.
- Paths: `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`. No new Markdown.
- Before/after: Source findings scattered among code and historic comments -> consolidated §9.2 matrix for Dashboard, Events, Activities, Financials, Timeline, Memories, Insights, Settings, Code Lists, forms, overlays, navigation and gesture QA; explicit design conventions and test/approval gates.
- Evidence: Reviewed source modules, existing CI and build. This is a source-only audit; **not** manual browser/device testing or a certified performance/security assessment.
- User/data/security: Documentation-only change. Existing Firestore/guest records untouched, no production deployment.
- Verification: Prior implementation build/test CI completed on earlier commits; this audit commit's CI pending. Real iOS/Android, WCAG, frame rate, cross-account Security Rules and Firebase preview usability tests NOT RUN. 9 dependency advisories remain.
- Risk/rollback: Do not claim full premium production quality until device/browser/security acceptance; update master and append future audit entries after measured validations.
- Master: §9.2 and §13, version 2.10.0.
- Status: SOURCE REVIEW DOCUMENTED / REAL-DEVICE QA PENDING.

## CHG-20261021-046 | Unify Code Lists swipe behavior with shared premium gesture rules
- Date (UTC): 2026-10-21.
- Branch: `OldVersion` only; `main` untouched.
- Paths: `src/pages/CodeLists.jsx`, Master Source of Truth, append-only audit.
- Before -> after: Code Lists used a hard-coded 40px swipe without axis locking and pointer capture that could interfere with vertical scrolling. Now shares `resolveSwipeGesture` (56px threshold, horizontal-axis lock, vertical-scroll cancellation), emits optional touch haptics once per revealed action and preserves tap-to-open keyboard action alternatives.
- Functional/security impact: Existing Code List edit/deactivate/delete handlers and confirmation remain unchanged. No configuration values or user data changed.
- Verification: Gesture utility already covered by Node tests. Full GitHub CI and actual phone scrolling not yet verified for this commit.
- Risks/rollback: Browser pointer behavior needs mobile QA; revert this commit if gesture compatibility problems arise.
- Master: version 2.9.11.
- Status: SOURCE IMPLEMENTED / CI AND DEVICE QA PENDING.

## CHG-20261021-045 | Prevent orphan activity-linked transactions and stale expense copies
- Date (UTC): 2026-10-21.
- Branch: `OldVersion` only; `main` unchanged.
- Changed paths: `src/utils/transactionRelations.js`, regression tests, `src/hooks/useTransactionManager.js`, Master and audit.
- Before -> after: Unified transaction saves accepted an arbitrary or stale activity prefill and deletes could silently skip removing nested expenses if events were not loaded -> now validates event/activity existence before committing linked transactions or deleting linked expenses, returning a recoverable error instead of leaving an orphan financial record.
- Data/security: Form URL query params remain untrusted hints, no authorization changes; the Firestore collection structure, guest storage and IDs are untouched. Linked-expense edits still use existing non-atomic cross-record coordination, requiring live tests.
- Verification: Added one Node regression test with valid, partial and stale associations. CI/build pending, no live Firebase/test-device access.
- Risks: Transactions referencing already-deleted activities must be unlinked before editing or deletion; user can clear a broken link in the form. Future reconciliation may automate cleanup.
- Master: §9.1, version 2.9.10.
- Status: SOURCE VERIFIED BY INSPECTION / CI PENDING.

## CHG-20261021-044 | Remove obsolete separate Income and Expense page/form modules
- Date (UTC): 2026-10-21.
- Owner request: Remove separate financial screens, forms and duplicate presentation.
- Branch/commit: `OldVersion`, this commit in Git history, `main` unchanged.
- Deleted: `src/pages/Income.jsx`, `src/pages/Expenses.jsx`, `src/components/income/IncomeForm.jsx`, `src/components/income/IncomeList.jsx`, `src/components/income/IncomeSummary.jsx`, `src/components/expenses/ExpenseForm.jsx`, `src/components/expenses/ExpenseList.jsx`, `src/components/expenses/ExpenseSummary.jsx`.
- Before/after: Eight obsolete route-exclusive/unused legacy UI files -> removed from active source. Financials and event-linked transaction creation use the unified Transactions form; protected legacy URLs redirect. Keep typed Firebase/guest income/expense stores and services to preserve existing data.
- Rationale: Prevent maintenance of multiple financial forms and eliminate dead code while preserving historical Git auditability.
- Verification: Inspected current route/component references on `OldVersion`; CI build and unit tests PENDING for this removal commit.
- Data/security: No data, Firestore collections, backup schemas or Firebase config deleted. Git history retains old source for rollback.
- Risk/rollback: If an unexpected dynamic import references removed files, restore specific source blobs from Git history; CI should catch compile-time imports.
- Master: §2 module source table and §13, v2.9.9.
- Status: SOURCE REMOVED, CI PENDING.

## CHG-20261021-043 | Restore scoped Code Lists in event activity drawer
- Date (UTC): 2026-10-21.
- Branch: `OldVersion` only, main unchanged.
- Paths: `src/pages/Events.jsx`, master, audit.
- Before -> after: Focused-event drawer referenced `adminValues` without an in-scope binding after extracting the event/activity-only drawer; now reads canonical Code Lists from `useAppStore` within the component. This prevents priority selector runtime ReferenceError and preserves existing activity editing.
- Verification: Source review; CI/build pending. Browser activity editing NOT RUN.
- Data: No persisted event or financial records changed.
- Risk/rollback: Same UI semantics, no schema change. Revert commit if necessary.
- Status: SOURCE FIXED / QA PENDING.

## CHG-20261021-042 | Eliminate remaining duplicate activity expense creation forms
- Date (UTC): 2026-10-21.
- Branch: `OldVersion` only, `main` unchanged; atomic Git commit in history.
- Paths: `src/pages/Events.jsx`, `src/features/events/components/EventWorkspaceShell.jsx`, `src/components/events/ActivityList.jsx`, master and audit.
- Before -> after: Event focus drawer and activity workspace had separate expense-only forms, duplicating financial entry. Activity Add Transaction now opens `/financials/transactions?create=transaction&event=<id>&activity=<id>` with editable Income/Expense type, prelinked activity and a single shared transaction form. Removed old event drawer expense-only UI and workspace ExpenseForm modal. Existing 'link an existing expense' capability retained for existing ledger records.
- Data/security: All financial writes continue through unified transaction coordinator, retaining existing collections and account/guest constraints. Event ID is a form prefill only, not authorization. No backend migration or existing records deleted.
- Verification: Source reviewed; GitHub Node/Vite CI and actual Firebase/guest/mobile navigation tests pending.
- Risk and rollback: Navigation switches to Transactions rather than inline event drawer; user can return via navigation; manual usability test required. Existing expense listing/reconciliation unchanged.
- Master: §3.1a and version 2.9.7.
- Status: SOURCE IMPLEMENTED / CI PENDING.

## CHG-20261021-041 | Link activity context into the unified Add Transaction form
- Date (UTC): 2026-10-21.
- Branch: `OldVersion` only; commit recorded in Git history. `main` untouched.
- Changed paths: `src/pages/Financials.jsx`, `src/components/financials/TransactionForm.jsx`, Master Source of Truth and append-only audit.
- Before -> after: Unified add form could not initialize a linked activity from an Event shortcut -> `/financials/transactions?create=transaction&event=<id>&activity=<id>` now preselects the event and activity, with existing authenticated/guest scoping and user-visible review before save.
- Data/security: No new collection, authorization grant, or schema change. Form still uses existing user-specific event list and records. Deep link parameters only prefill a selection, not bypass access.
- Verification: GitHub CI pending after commit; guest/account end-to-end link creation and browser navigation NOT RUN.
- Risks: Missing/deleted linked event remains a form validation/UX edge case; require data consistency checks before saving financial links. Revert commit for rollback.
- Master: §3.1a, version 2.9.6.
- Status: SOURCE IMPLEMENTED / CI AND USER QA PENDING.

## CHG-20261021-040 | Improve shared swipe gesture safety and mobile touch feedback
- Date (UTC): 2026-10-21.
- Branch/commit: `OldVersion`, Git SHA in history; `main` untouched.
- Changed paths: `src/hooks/useSwipeActions.js`, `src/utils/swipeGestures.js`, `src/utils/swipeGestures.test.mjs`, master and audit.
- Before -> after: Shared Activity/Code Lists swipe hook revealed actions after 40px with weak axis discrimination. New pure threshold calculation locks vertical scroll, requires dominant horizontal gesture plus 56px travel before action reveal, only haptics on supported touch devices and only on entering an action. Prevents destructive accidental reveal and preserves existing left=other, right=delete API.
- User/data/security impact: Touch and pointer UX only; same underlying callbacks/state; no database changes. Does not provide or imply real iOS haptics if not supported by browser.
- Verification: Added 4 gesture unit tests; CI and real-device/60fps performance measurement pending.
- Risk/rollback: Gesture thresholds may require user tuning; screenshot/touch/browser verification needed. Revert commit to recover previous behavior.
- Master: §§6, 9, 13; v2.9.5.
- Status: SOURCE IMPLEMENTED / CI PENDING.

## CHG-20261021-039 | Guard filter retention and account-scoped financial data during refresh
- Date (UTC): 2026-10-21.
- Actor: AI integration review for owner's unified Transactions request.
- Branch/commit: `OldVersion` (SHA in commit history); no `main` changes.
- Paths: `src/pages/Financials.jsx`, `src/components/financials/TransactionForm.jsx`, master and audit.
- Before -> after: A saved month could reset to All before async stores reloaded; records from an old account might display during a user switch because expense store retains cached data; locale-dependent default date may not be ISO. Now selected month is cleared only after both stores finish loading current account/guest scope. Records are suppressed until both scoped stores match. Default form date is generated as local YYYY-MM-DD.
- Why: User requests stable filters, accurate scoped summaries and safe transactions during refresh/switch.
- Data/security: No Firestore schema changes or record writes. Prevents stale cross-account UI disclosure while loading.
- Verification: Node/Vite CI pending for this commit, guest/account browser integration NOT RUN.
- Risk/rollback: Loading spinner may appear until both stores successfully load; failures show the existing Retry banner. Revert this commit if necessary.
- Master: §3.1a, §13; version 2.9.4.
- Status: SOURCE IMPLEMENTED / CI PENDING.

## CHG-20261021-038 | Shared premium event action overlays and button targets
- Date (UTC): 2026-10-21.
- Branch/commit: `OldVersion`; `main` unchanged.
- Paths: `src/design-system.css`, master, audit.
- Before/after: New event menu had no styles; now token-driven frosted popover, high viewport-aware overlay, 44px trigger/options, focus states, reduced-motion support and a muted Archived badge; important buttons share minimum touch height. Transaction swipe action stacking corrected.
- Why: Consistent premium Lucide-based UI across Events and Financials without altering business data.
- Verification: CSS committed, Node/Vite CI and manual light/dark mobile checks pending.
- Risk/rollback: Existing global selectors may conflict at some responsive breakpoints, verify on device; revert commit to rollback.
- Master: §§6/9/13, v2.9.3.
- Status: SOURCE IMPLEMENTED, QA PENDING.

## CHG-20261021-037 | Unify event detail hero actions with premium overflow menu
- Date (UTC): 2026-10-21.
- Branch/commit: `OldVersion`, Git SHA in history, `main` unchanged.
- Files: `src/features/events/components/EventWorkspaceShell.jsx`, master, audit.
- Before/after: Tiny detached hero delete icon -> single event overflow action with Edit (existing EventForm in modal), Duplicate (fresh task/event IDs without duplicate expenses), Share (guest text or authenticated deep-link), Archive/Restore, Delete confirmation. Keep Add Memory and Greeting Card visible as dedicated contextual actions.
- Why: Premium event detail action hierarchy and consistency with story cards.
- Data/security: Archive reversible; cloned events do not copy real financial transactions; sharing private event links still requires account permissions.
- Verification: CI build, manual browser and Firestore guest/account checks pending; no deployment.
- Risk/rollback: Modal positioning/portal focus and guest share behavior require browser testing. Revert commit if necessary.
- Master: §9, §13, v2.9.2.
- Status: SOURCE IMPLEMENTED, CI PENDING.

## CHG-20261021-036 | Fix archived-event picker filter grouping
- Date (UTC): 2026-10-21.
- Branch/commit: `OldVersion`; exact SHA in Git history, `main` unchanged.
- Paths: `src/pages/Events.jsx`, master, audit.
- Before/after: Adding archived exclusion introduced an extra opening parenthesis in active-event activity picker expression. Closed grouping so search remains constrained to unarchived events, while Archived rail still exposes archived cards.
- Verification: Source corrected, CI/build pending. Data unchanged, no deployment.
- Risk/rollback: None beyond existing archive user flow, manual QA needed.
- Master: §§9,13, v2.9.1.
- Status: SOURCE FIXED, CI PENDING.

## CHG-20261021-035 | Event story cards use single action overflow and archived view
- Date (UTC): 2026-10-21.
- Branch/commit: `OldVersion`, SHA in Git history; `main` untouched.
- Files: `src/pages/Events.jsx`, `src/components/events/EventActionMenu.jsx`, master and audit.
- Before/after: Tiny detached swipe action controls on event story cards -> single 44px overflow menu (Edit, Duplicate, Share, View Summary, Archive/Restore, Delete) positioned above content. Archived items appear under explicit Archived filter and group; active filters exclude archived by default.
- Business semantics: Archive is reversible and does not delete activity/financial records. Duplicate creates fresh event/task IDs but excludes actual booked expense records to avoid double counting. Guest sharing text-only, account link subject to sign-in access.
- UX: Menu options keyboard accessible and viewport aware; current primary event open/card rendering remains. Swipe no longer required to expose event actions.
- Verification: CI, guest/account archive/duplicate and device testing pending.
- Risks: Long menu mobile keyboard/focus and old event status styles need visual testing; using old screenshots may show prior layout. Revert commit if needed.
- Master: §§4, 9, 13, v2.9.0.
- Status: SOURCE IMPLEMENTED / CI PENDING.

## CHG-20261021-034 | Persist a reversible event archive state
- Date (UTC): 2026-10-21.
- Branch/commit: `OldVersion`, SHA in Git history; `main` unchanged.
- Files: `src/utils/eventStatus.js`, `src/utils/eventStatus.test.mjs`, `src/services/eventService.js`, master, audit.
- Before/after: Event domain only recognized completed/cancelled/in-progress -> preserves boolean archived state and resolves archived status without destroying prior completion/cancelled details. Unarchive reverses flag.
- Rationale: The owner requests an Archive/Restore action in the event overflow menu.
- Data/security: Adds optional archival metadata to existing event documents and guest eventGroups. Old records default to not archived; no migration.
- Verification: Unit status test added, CI and event UI integration pending. No deployment.
- Risk: Event list/overview filters must deliberately expose an Archived view so records are not stranded; subsequent commit handles this.
- Master: §§4, 9 and 13, v2.8.5.
- Status: SOURCE IMPLEMENTED, EVENT UI WIRING PENDING.

## CHG-20261021-033 | Shared event overflow action control
- Date (UTC): 2026-10-21.
- Branch/commit: `OldVersion`; `main` untouched.
- Paths: `src/components/events/EventActionMenu.jsx`, master and audit.
- Before/after: Detached event icon actions -> shared popup with Edit, Duplicate, Share, Archive/Restore and Delete actions, viewport-aware portal, 44px intended targets and Escape/Tab/arrow/home/end keyboard behavior.
- Rationale: Premium compact event card and workspace actions.
- UX/security: Existing business actions provided by parents; no direct Firestore operations in menu itself. URL sharing depends on account permissions.
- Verification: Source created; parent wiring/CI/mobile browser tests pending. Rollback by git revert.
- Master: §9 and §13, v2.8.4.
- Status: COMPONENT CREATED, INTEGRATION PENDING.

## CHG-20261021-032 | Safe event duplicate and share data helpers
- Date (UTC): 2026-10-21.
- Branch/commit: `OldVersion`, SHA in Git history, `main` untouched.
- Files: `src/utils/eventActions.js` and tests, master, audit.
- Before/after: Event menu actions were limited; added pure duplicate/share data preparation. Duplicates copy event planning metadata and activity task titles but use fresh IDs and exclude nested expense money, memories, attachments and original Firestore references.
- Why: Premium overflow menu must not inadvertently duplicate financial ledger amounts.
- Security/data: Guest share exports text only (not inaccessible cloud deep link). Account deep links still require Firebase authentication.
- Verification: Two Node tests added; UI wiring and CI pending. No production deployment.
- Risk: Duplication of attachments deliberately unsupported until a real file-ownership model exists; rollback via Git.
- Master: §9 and §13, v2.8.3.
- Status: HELPER IMPLEMENTED / MENU INTEGRATION PENDING.

## CHG-20261021-031 | Replace global Expense quick-create with Add Transaction
- Date (UTC): 2026-10-21.
- Branch/commit: `OldVersion`, SHA in Git history; `main` unchanged.
- Paths: `src/layouts/DashboardLayout.jsx`, master and audit.
- Before/after: Mobile and desktop quick-create menus offered Expense with a separate form -> Transaction with unified Income/Expense form and same mutation coordinator as Financials. CTA toast links to combined Transactions screen.
- Why: Remove duplicate financial creation flow, preserve event and activity quick-create.
- User/data/security: Both typed records still persist in existing account/guest stores; account-only or guest works through shared manager. No migration.
- Verification: CI compile, unit tests and actual end-to-end account/guest actions pending. No deployment.
- Risks/rollback: Existing links to `/financials/expenses` redirect; transaction activity mirror non-atomic. Revert this commit to restore old quick menu if needed.
- Master: §3.1a, §13, v2.8.2.
- Status: SOURCE IMPLEMENTED, CI PENDING.

## CHG-20261021-030 | Premium responsive financial styling pass
- Date (UTC): 2026-10-21.
- Branch/commit: `OldVersion`, atomic SHA in Git history, `main` untouched.
- Paths: `src/design-system.css`, master, audit.
- Before/after: Added scoped token-based premium Transactions/Overview layout, 3 controls in flexible grid, two columns on narrow phones, one at extreme width, 44px action targets, income-green/expense-red amounts, frosted swipe actions, reduced-motion handling, consistent modal/form controls and dark/light tokens.
- Why: Remove fractured financial presentation while respecting existing app visual tokens.
- User/data/security impact: CSS only, no business logic or persistence changes.
- Verification: CI build pending; manual mobile and dark/light device QA not run.
- Risk/rollback: Older global CSS specificity may override new rules in certain screens; append-only styling can be reverted by commit.
- Master: §6.4 and §13, v2.8.1.
- Status: SOURCE COMMITTED, CI/DEVICE QA PENDING.

## CHG-20261021-029 | Replace legacy financial navigation with Overview / Transactions
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner, financial module consolidation.
- Branch / commit: `OldVersion`, commit SHA in Git history; `main` untouched.
- Changed paths: `src/App.jsx`, `src/pages/Financials.jsx`, master, audit.
- Before -> after: Separate income/expense routes and summary previews -> Overview and Transactions only; old paths redirect; unified Add/Edit/Delete modal, shared filter state and responsive card view, summary totals update from the same filtered set, session-scoped filters survive reloading.
- Rationale: Consolidate records without a destructive data migration.
- User/data/security impact: Existing income/expense collections and guest storage are preserved; no production deployment or Firestore rules change. New transaction edits and type transitions are coordinated through existing stores.
- Verification: Source code committed; Node/Vite CI and real device/Firebase tests pending. No deployment.
- Risks: User data must be verified in guest/account flows; activity-linked mirrors are not atomic. Old links redirect.
- Master: §3.1a and §13, v2.8.0.
- Status: SOURCE IMPLEMENTED, CI PENDING.

## CHG-20261021-028 | Unified premium transaction cards and filter panel
- Date (UTC): 2026-10-21.
- Branch/commit: `OldVersion`, commit SHA in history. `main` untouched.
- Paths: `src/components/financials/TransactionHistory.jsx`, master and append-only audit.
- Before/after: Plain transaction list -> premium cards with signed income/expense coloring, activity/date/categories, left-swipe spring Edit/Delete reveal and always-available overflow button, optional haptic where supported; filters Search, Type, data-only Month and Sort in shared component.
- UX/data impact: Rendering only, existing transaction IDs/persistence unaffected; accessibility controls available without swiping. Honours reduced-motion preference.
- Verification: Parent integration and CI test pending. No deployment.
- Risk/rollback: Touch gesture interference and actual frame rate require device testing.
- Master: §9.1, §13, v2.7.3.
- Status: SOURCE CREATED, PARENT INTEGRATION PENDING.

## CHG-20261021-027 | Coordinate unified Income/Expense writes and linked activity records
- Date (UTC): 2026-10-21.
- Branch/commit: `OldVersion`, SHA in history; `main` unchanged.
- Scope: `src/hooks/useTransactionManager.js`, `src/utils/transactionRelations.js`, tests, master and audit.
- Before/after: Unified form had no routing logic; hook now dispatches to existing typed stores and synchronizes expense mirrors inside linked activities while preserving income activity IDs as metadata.
- Edge cases: Authenticated nested-only expense editing/deletion updates event aggregate without writing to nonexistent Firestore expense doc; type conversion writes the replacement first, then removes previous and best-effort rolls back the replacement on failure.
- Data/security: Existing Firestore collections, guest storage and backup schemas unchanged. Writes spanning expense/event aggregates are **not atomic**, so partial failures require reconciliation.
- Verification: Four Node reconciliation tests added; awaiting CI and actual Firebase/guest integration. No deployment.
- Risk: Activity-link changes and simultaneous cloud writes may partially succeed. Preserve IDs and notify user on incomplete sync. Rollback via Git history.
- Master: §9.1, §13; 2.7.2.
- Status: SOURCE INTEGRATED, UI FOLLOW-UP AND CI PENDING.

## CHG-20261021-026 | Introduce a unified Add/Edit Transaction form
- Date (UTC): 2026-10-21.
- Requester: DN owner, financial premium redesign.
- Branch/commit: `OldVersion`; atomic SHA in Git history; `main` untouched.
- Files: `src/components/financials/TransactionForm.jsx`, master, append-only audit.
- Before/after: Separate income and expense field forms -> shared UI for Income/Expense type, positive amount, title, category, optional linked activity, date, notes. Category choices come from existing Code Lists; uses the established shared dropdown and date controls.
- Why: Single form for new/edited financial transactions without changing Firestore or guest data schema.
- Data/privacy: Existing `type` and `category` persisted keys remain differentiated via the transaction mapper. No write path changed by this commit alone.
- Verification: Source added, pending integration, CI and manual mobile review. No deployment.
- Rollback: Revert file/commit, historical forms remain in Git.
- Master: §9.1, §13, version 2.7.1.
- Status: FORM CREATED, PARENT INTEGRATION PENDING.

## CHG-20261021-025 | Add backwards-compatible unified transaction data model
- Date (UTC): 2026-10-21.
- Actor/requester: Owner's Financial Module Simplification and Premium UX request.
- Branch/commit: `OldVersion`; this atomic commit in Git history. `main` unchanged.
- Files changed: `src/utils/transactionFilters.js`, its Node tests, `src/services/incomeService.js`, `src/services/expenseService.js`, master and audit.
- Before -> after: Filter months included empty 12-month ranges; summary totals did not follow composed filters; older income/expense models dropped some new transaction fields. Now month options use actual record dates only; composed search/type/month filters feed reconciled income/expense/balance; sort supports date, amount and title; unified form adapter writes into the existing typed records; notes/activity relationships persist.
- Rationale: Consolidate income and expenses at UI level while preserving stable account/guest backup contracts.
- UX/data/security/compatibility: No Firestore collection changes, old documents remain readable, no record rewrites. Income adds optional notes/eventId/activityId fields; expenses preserve optional notes. Existing nested expenses require subsequent reconciliation.
- Verification: Added eight pure Node tests; GitHub CI/build not yet verified for this commit, browser/backend NOT RUN.
- Risk/rollback: Consumers using old transactionsMonthOptions signature are updated in a subsequent UI commit. No destructive migration; revert commit if needed.
- Master: §§9.1 and 13; version 2.7.0.
- Status: DATA-LAYER IMPLEMENTED, UI FOLLOW-UP REQUIRED.

## CHG-20261021-024 | Firebase preview blocked by missing GitHub Actions credential
- Date (UTC): 2026-10-21.
- Actor/requester: Repository owner requested Firebase-hosted usability test; connected GitHub CI recorded results.
- Branch / commit / runs: `OldVersion` source commit `29e22b8441cad058548836c02b82f6d7a076f853`; preview run https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39648814699; documentation run https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39648814283. This documentation-only update commit recorded in Git history. `main` unchanged.
- Changed paths: `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Deployment attempt pending -> confirmed credential-check failure, no Firebase upload, no preview URL. User can configure `FIREBASE_SERVICE_ACCOUNT` in GitHub Actions or connect Firebase to enable a retry.
- Rationale: Must preserve accurate audit of failed external deployment without claiming an inaccessible preview exists.
- Verification: Preview run `npm ci` PASS, `npm test` PASS 60/60, `npm run build` PASS. `Verify Firebase deploy credentials` FAIL: `FIREBASE_SERVICE_ACCOUNT` environment was empty. `FirebaseExtended/action-hosting-deploy` SKIPPED; preview URL publication SKIPPED. Separate governance workflow PASS. Firebase-hosted behavior NOT TESTED.
- User/data/security/compatibility impact: No upload, no release, no Firebase Auth/Firestore operations, no changes to live Hosting, no `main` modification. No secret value recorded.
- Risk and rollback: Credential must be added by an authorized operator with limited Hosting permissions; private secret must never be posted in chat or source. Once configured, rerun the failed GitHub job, verify URL, then append success/failure evidence. No live channel changes required.
- Master: §6.5 and §13, version 2.6.6.
- Status: DEPLOYMENT BLOCKED, NOT DEPLOYED.

## CHG-20261021-023 | Attempt Firebase usability preview deployment from OldVersion
- Date (UTC): 2026-10-21.
- Owner/requester: Repository owner requested Firebase deployment of DN OldVersion for usability testing.
- Branch / commit: `OldVersion`; this atomic commit tagged `[deploy-preview]` (SHA in Git history). `main` not modified.
- Changed paths: `.github/workflows/dn-oldversion-firebase-preview.yml`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Existing Firebase Hosting production script, but no preview deploy workflow. Added opt-in OldVersion-only GitHub Actions workflow that builds/tests current code and attempts non-live Firebase preview `oldversion-usability` with 14-day expiry.
- Rationale: Provide a shareable usability-test URL without overwriting the live site or merging branches.
- User/data/security impact: Hosting frontend preview only, no Firestore schema/rules changes. Preview uses the real Firebase backend of the project. GitHub Actions secret `FIREBASE_SERVICE_ACCOUNT` is required but not visible to the assistant; no credential committed.
- Verification: Prior source version passed 60/60 tests and production build. Preview job, credentials, URL, hosted UX: PENDING until this workflow runs. No local authenticated Firebase CLI available.
- Risk/rollback: Secret may be missing, service account lacks Hosting permissions, Google Auth may reject preview hostname, URL is shareable/public to recipients. Remove/expire preview channel; live Hosting unchanged.
- Master sections: §6.5 and §13; version 2.6.5.
- Status: WORKFLOW COMMITTED, DEPLOYMENT RESULT PENDING. Append a subsequent audit entry with actual result, never invent a URL.

## CHG-20261021-022 | Record final CI verification for shared dropdowns and Transactions filters
- Date (UTC): 2026-10-21.
- Actor/requester: AI result verification for owner's responsive transactions and overlays request.
- Branch / commits: `OldVersion`. Verified `f735cf9a2e3c94c1a6301cc097ee3a21840de6d6` via GitHub Actions [run 39646417362](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39646417362). This audit-only commit has its own Git SHA. No changes to `main`.
- Paths changed: `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md` only.
- Before -> after: Runtime/test validation previously marked CI pending -> GitHub Node tests, Vite production build and documentation audit now verified successful after menu scroll bug fix and filter label correction.
- Why: Record actual evidence for later AI sessions and avoid misrepresenting browser tests.
- Verification: `npm ci` PASS; `npm test` PASS **60/60**; `npm run build` PASS; governance PASS, as reported by job logs. New audit-only commit's own CI requires read-back. Real Android/iOS/tablet responsive visual/browser inspection, keyboard+native date picker UX, actual Firestore/guest integration: NOT RUN.
- User/data/security/compatibility impact: Documentation-only; no code, schema, live transaction or deployment changes. Nine dependency advisories (3 moderate, 6 high), Vite chunk warning remain unrelated open review items.
- Risks/rollback: Mobile-specific viewport quirks still require testing; rollback source commits via Git revert if issues appear, use historical audit for traceability.
- Master: §6.4, §13, version 2.6.4.
- Status: PREVIOUS SOURCE COMMIT CI VERIFIED, MANUAL MOBILE QA PENDING.

## CHG-20261021-021 | Prevent dropdown menu scroll from snapping back to selection
- Date (UTC): 2026-10-21.
- Actor/requester: AI follow-up to user's requirement to scroll and select every option.
- Branch / commit: `OldVersion`, this atomic Git commit; `main` untouched.
- Paths: `src/components/common/DropdownSelect.jsx`, master, audit.
- Before -> after: Window capture-phase scroll listener could call `reposition` when scrolling the menu's own option list, creating a new placement object and retriggering selected-option scroll logic. Listener now ignores scroll events arising inside the menu while still tracking page/modal/viewport scroll, resize and orientation.
- Why: Ensure long menus remain independently scrollable and don't jump back to the selected item while the user browses other options.
- Data/UX/security: Shared UI only, no value/filter/data behavior changed.
- Verification: Source review completed; prior GitHub Actions source change 68860bb passed 60 Node tests and Vite build; this change awaits its own CI. Mobile browser touch scrolling NOT RUN.
- Risk / rollback: Browser-specific scroll propagation and touch input need manual checks; rollback via this commit if needed.
- Master: §§6.4 and 13; version 2.6.3.
- Status: SOURCE IMPLEMENTED / CI PENDING.

## CHG-20261021-020 | Align the Transaction Type reset option with the requested All label
- Date (UTC): 2026-10-21.
- Actor/requester: AI refinement of owner's exact option requirements.
- Branch/commit: `OldVersion`, identify commit in Git history; `main` untouched.
- Paths: `src/components/financials/TransactionHistory.jsx`, master and this audit.
- Before -> after: First type option displayed “All transactions” in desktop menu -> now “All” at all breakpoints, with unchanged `all` value. The Month filter retains “All months”.
- Why: Exact Transaction Type option names: All, Income and Expense, with matching short mobile label.
- User/data/security: Presentation-only label change, filter behavior and stored values unchanged.
- Verification: Automated CI and build on previous source commit 68860bb succeeded with 60 tests, 0 failures. New commit test/build pending. No browser or Firebase tests.
- Risks/rollback: None beyond usual UI regression risk; revert this commit to restore wording.
- Master: §3.1a and §13; version 2.6.2.
- Status: SOURCE UPDATED / CI PENDING.

## CHG-20261021-019 | Verify responsive transaction/overlay changes and correct listbox semantics
- Date (UTC): 2026-10-21.
- Actor/requester: AI verification and accessibility follow-up for owner's transaction and overlay task.
- Branch / commit: `OldVersion`; this atomic commit in Git history, `main` unchanged.
- Paths changed: `src/components/common/DropdownSelect.jsx`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Portalled menu root owned a listbox role containing an interactive search input. Moved `role=listbox` and `id` to the scrollable options container, keeping the search outside its ARIA hierarchy while the trigger `aria-controls` still refers to the options list. Validated previous source via CI.
- Why: Improve screen-reader semantics without changing shared filtering/selection or overlay geometry.
- UX/data/security: Accessibility refinement only; no storage, Firestore or financial data behavior changes.
- Verification: GitHub Actions run 39645286731 on previous implementation commit 68860bb passed `npm test` **60/60**, `npm run build` PASS and documentation-contract PASS; workflow job logs inspected. This post-verification markup tweak requires its own CI run. Device viewport, touch keyboard, calendar and Firebase manual tests NOT RUN.
- Risk/rollback: Browser focus and mobile keyboard interactions still need manual checks; source commit can be reverted without persisted data effects. Known npm dependency advisories remain 9 (3 moderate, 6 high).
- Master: §§6.4, 13; version 2.6.1.
- Status: SOURCE COMMITTED, FOLLOW-UP CI PENDING.

## CHG-20261021-018 | Responsive combined Transactions search and two filters
- Date (UTC): 2026-10-21.
- User request: Replace the single Transactions category selector with independently combinable Type and Month filters; keep search and existing transaction presentation.
- Branch/commit: `OldVersion`, exact atomic SHA in Git history; `main` unchanged.
- Changed paths: `src/pages/Financials.jsx`, `src/components/financials/TransactionHistory.jsx`, `src/utils/transactionFilters.js`, `src/utils/transactionFilters.test.mjs`, `src/design-system.css`, master and audit.
- Before -> after: Inspected branch has no standalone Transactions route or existing “All transactions” dropdown: Financials overview has separate income/expense preview sections. A new combined Transactions section was added **below** existing overview previews, without removing or changing navigation, cards, or add controls. Search field first, equal two-column Type (All/Income/Expense) and Month filters after, 12px gap; stack only at <=310px. Month options include recent months and recorded older months; abbreviated selected mobile labels.
- Behavior: Filters compose conjunctively, search includes description/category/type/amount/date, empty state handles zero matches, scoped sessionStorage preserves filters across store refresh/add/reload. Income/expense key namespace avoids collisions.
- Why: Match requested filtering while preserving current app architecture and visual system.
- User/data/security impact: Read-only combined view; no transaction mutations, cloud schema, Firestore Rules, or production deployments. Session-storage keys scoped by active account.
- Verification: Added five pure filtering/month regression tests. `npm test`/Vite build/real browser tests PENDING CI; no direct Firebase/browser testing.
- Risk/rollback: Date availability, narrow viewport layout, screen-reader behavior and mobile dropdown interactions need browser/device verification. Revert relevant commit if needed without affecting stored transaction records.
- Master updated: §3.1a and version 2.6.0.
- Status: SOURCE IMPLEMENTED, CI PENDING.

## CHG-20261021-017 | Shared responsive dropdown and overlay positioning
- Date (UTC): 2026-10-21.
- Owner/request: Make every dropdown and calendar responsive and prevent clipping behind app overlays.
- Branch / commit: `OldVersion`; exact commit SHA in Git history. `main` untouched.
- Paths: `src/components/common/DropdownSelect.jsx`, `src/utils/overlayPosition.js`, `src/utils/overlayPosition.test.mjs`, `src/design-system.css`, master and audit.
- Before -> after: Inline absolute-position dropdowns were clipped by cards, modals and scroll panes; now portal to body at computed viewport-aware location, flip above when insufficient space, constrain max height/width, avoid fixed mobile dock, reposition on scroll/resize/orientation/mobile visual-viewport events. Long lists gain option search, selected-item scroll, scroll containment and consistent keyboard/focus controls. Shared date fields continue using native browser pickers (which are managed by OS/browser outside CSS clipping).
- Why: Fix the root component used across forms and filters without per-page business logic changes.
- User/data/security/compatibility: UI only; onChange keeps the original synthetic target value/name shape. No persistence, Firebase or backend changes. Portal opens above modal by high stack index; native browser calendar positioning is outside JS control.
- Verification: Four placement unit assertions introduced. Node tests, Vite build, browser/mobile visual tests NOT YET RUN in this commit. CI verification to follow.
- Risks/rollback: CSS/browser viewport variations, keyboard and focus behavior in modal contexts require real-device checks. Revert commit if regression detected; no data migration required.
- Master: §6.4 and version 2.5.0.
- Status: SOURCE IMPLEMENTED / CI PENDING.

## CHG-20261021-016 | Record passing DN safeguards and eliminate obsolete name from AI rules
- Date (UTC): 2026-10-21.
- Actor/requester: Owner's follow-up request to retry and fully verify DN branding.
- Branch/commits: `OldVersion`; verified source commit `ecafb3f6b3818d9caa4efc08202db7e9cb454dd8`, GitHub Actions [run 39643523554](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39643523554). This documentation-and-agent wording commit identifiable in Git history. `main` untouched.
- Paths changed: `AGENTS.md`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Post-fix brand tests were awaiting CI, and normative agent instructions contained an obsolete product label even in a prohibition -> CI outcome captured and normative instruction uses DN exclusively, referring to previous branding only generically. Historical audit entries remain append-only and unchanged.
- Reason: Prevent reintroduction of deprecated product identity in future AI sessions, while maintaining traceable verified results.
- Data/UX/security: Documentation and agent wording only, no application behavior, stored data, security rules, or deployment change. Old browser keys and old-backup test fixtures remain for backward compatibility.
- Verification: OldVersion GitHub Actions run 39643523554 **PASS**, `npm test` **51 passed / 0 failed**, `npm run build` **PASS** (Vite), documentation-contract **PASS**; results from job logs. Dependency installation lists 9 advisories (3 moderate/6 high) not fixed. New commit's own subsequent CI run requires its own verification. Browser/device tests, live Firebase permission tests and backup/guest data migration with real user data: NOT RUN.
- Risk and rollback: CI validates source and compilation, not the live Firebase/data migration. Restore AGENTS wording from previous Git commit only with an audited owner-approved change.
- Master updated: §7 CI evidence, §13 version 2.4.7.
- Status: PREVIOUS BRAND-REGRESSION COMMIT VERIFIED; THIS DOC-ONLY COMMIT REQUIRES CI READ-BACK.
- Follow-ups: Browser-based old-device guest-data/backup validation, dependency security review, required checks on OldVersion.

## CHG-20261021-015 | Repair DN branding regression test before claiming validation
- Date (UTC): 2026-10-21.
- Actor/requester: AI correction during owner's repeat DN branding verification request.
- Branch / commit: `OldVersion`, associated atomic commit in Git history; `main` remains unchanged.
- Changed paths: `src/brandIdentity.test.mjs`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: New test had double-escaped regular expressions and path separators; corrected to valid JavaScript regexes, portable path handling, and explicit checks for the DN product title, About screen, source styling, and exactly four Markdown files.
- Reason: A newly created test must not be advertised as enforced until it parses and passes in CI.
- User/data/security/compatibility impact: Tests and documentation only. Legacy storage migration and data remain unchanged. The old brand is forbidden in active app copy, not in compatibility identifiers or historical audit/fixture data.
- Verification: Source correction committed; GitHub Actions `npm test` and `npm run build` pending at time of commit. No production deployment or live Firebase/browser test.
- Risk/rollback: The scanning test intentionally excludes legacy compatibility code, fixture files and audit-history material. Revert this commit if it causes false positives; the core app behavior remains unchanged.
- Master: §2 naming and §13 history; version 2.4.6.
- Status: SOURCE FIXED, CI VERIFY PENDING.

## CHG-20261021-014 | Prevent recurrence of retired product branding
- Date (UTC): 2026-10-21.
- Requester/actor: Repository owner; implementation and review via connected GitHub tools.
- Branch / commit / PR: `OldVersion`; exact SHA of this atomic commit in Git history. `main` unchanged.
- Changed paths: `src/brandIdentity.test.mjs`, `AGENTS.md`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Brand migration passed previous 48 unit tests and build, but there was no automated check to prevent a future agent from reintroducing deprecated UI branding. Added Node tests asserting DN in package/manifest/HTML/About, banning the retired name in production app source outside its narrow data-compatibility bridge, and enforcing the exact four-file Markdown budget. AI rules reinforced.
- Reason: The owner explicitly requests that future AI work never misidentify the product; old saved keys and test fixtures must remain readable without becoming visible branding.
- User/data/security/compatibility impact: Tests/documentation only. No app runtime, existing browser data, Firebase configuration, or deployment changes. Historical records remain intact.
- Verification: New tests added to `npm test`; CI execution for this commit PENDING when written. Previously verified baseline (48 passed, Vite build passed) is in CHG-20261021-013. Browser/device and live Firebase tests NOT RUN.
- Risk/rollback: The source scanner intentionally excludes the dedicated storage migration bridge and historical test/audit evidence to avoid deleting compatibility. CI enforcement relies on GitHub Actions; revert this commit if the validator incorrectly rejects a legitimate case.
- Master sections updated: §2 product naming, §8 no-new-Markdown governance, §13 version history.
- Status: SOURCE COMMITTED; POST-COMMIT CI VERIFICATION PENDING.

## CHG-20261021-013 | Record verified DN CI pass and dependency warning
- Date (UTC): 2026-10-21.
- Actor/requester: GitHub CI verification captured during owner's DN branding task.
- Branch / commit / CI: `OldVersion`; application source SHA `22aa6403bbbc86f0e589d57d0a475571e38a320f`, GitHub Actions run [39642206927](https://github.com/Divin-kumar/DN_APP_MAIN/actions/runs/39642206927); this documentation-only commit SHA available in history.
- Changed paths: `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`. No new Markdown files or app code changes.
- Before -> after: Previous audit entry marked parser repair CI pending -> confirmed `npm ci` SUCCESS, `npm test` **48 passed / 0 failed**, `npm run build` SUCCESS, documentation governance SUCCESS. The earlier CI failure was resolved.
- Why: Full traceability of actual verification outcomes rather than assuming passing tests.
- User/data/security impact: Documentation only. No production deployment or user data writes. Package installation warned of 9 dependency advisories (3 moderate, 6 high), not automatically fixed.
- Verification: GitHub workflow job logs inspected. Browser/device UX, guest/account data migration on real browsers, Firebase Security Rules and live restore NOT RUN.
- Risk and rollback: New code path passed Node/build; production security and data migration still require manual validation. Log is append-only; correct errors via new entries only.
- Master: §§7, 10, 13; version 2.4.4.
- Status: **CI VERIFIED**, browser/Firebase acceptance outstanding.

## CHG-20261021-012 | Repair backup parser syntax detected by CI
- Date (UTC): 2026-10-21.
- Trigger: OldVersion CI run `39641812804`, application-smoke-tests failed with SyntaxError in `src/services/backupService.js` line 148; 40 tests passed, one test file failed to load, build was skipped.
- Actor/requester: AI fix in response to the owner's DN branding request.
- Branch/commit: `OldVersion`, atomic corrective commit (SHA in history); no `main` changes.
- Scope: `src/services/backupService.js`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: A malformed string replacement accidentally inserted duplicate module contents into a v2-backup dashboard-key regex -> reconstructed parser from the last clean original source, with explicit DN/legacy prefixed setting lookups and correctly escaped dynamic regexes.
- Reason: Fix a real automated test failure and preserve old v1/v2 backup import compatibility.
- Impact: Restores existing backup parser compilation; no schema/version change or backend writes. New DN data remains canonical, older backups continue to import.
- Verification: CI failure inspected from job log and source rebuilt deterministically; rerun of `npm test`/`npm run build` via GitHub Actions expected after push, actual outcome to be inspected. Live Firebase/browser NOT RUN.
- Risk/rollback: Restore original pre-migration service via Git commit if needed; missing import or regex issues are covered by existing backup tests plus new DN v2 test.
- Master sections: §5, §7, §13; version 2.4.3.
- Status: SOURCE FIX COMMITTED, CI RERUN PENDING.

## CHG-20261021-011 | Lock DN-only terminology and add OldVersion build verification
- Date (UTC): 2026-10-21.
- Owner instruction: DN is the only app brand, not the retired historic name.
- Branch/commit: `OldVersion`; exact SHA is the Git commit containing this entry. No `main` changes.
- Changed files: `README.md`, `AGENTS.md`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`, `.github/workflows/documentation-governance.yml`.
- Before -> after: Residual historic class-prefix wording removed from normative master; AI naming rule clarified; OldVersion CI upgraded to run locked install, Node unit tests and Vite build in addition to governance checks.
- Rationale: Preserve DN as the exclusive user-facing identity and validate that storage compatibility and stylesheet renames compile successfully.
- User/data/security/compatibility: Docs/CI only; tests install packages in GitHub Actions runner but do not deploy to Firebase. No modifications to `main` or app persistence in this commit.
- Verification: GitHub Actions success/failure must be verified separately after push; app unit/build/browser/Firebase verification is NOT YET KNOWN at time of commit.
- Risk/rollback: CI may detect preexisting failures; resolve in audited follow-up. GitHub required checks depend on repository protection settings.
- Master: §§3, 7, 10, 13; version 2.4.2.
- Status: IMPLEMENTED IN SOURCE / CI PENDING.

## CHG-20261021-010 | Finalize DN identity and remove stale named artifacts
- Date (UTC): 2026-10-21.
- Actor/requester: Owner's explicit DN brand decision.
- Branch / commit: `OldVersion`, atomic Git commit (SHA in history); `main` unchanged.
- Changed paths: `src/utils/codeLists.js`, `public/manifest.webmanifest`, `AGENTS.md`, master, audit; renamed old insights JSON filename to `dn-insights-2026-10-01.json` without altering data; removed `extract_requirements.py` (obsolete local Windows-path script referencing a missing Word file).
- Before -> after: PWA extended display name -> exactly DN; Node ESM import missing `.js` -> explicit file extension; retired named artifact -> DN filename; obsolete extraction script removed; strengthened AI brand rule.
- Why: Finish canonical product naming and prevent an ESM module resolution failure in the Node unit suite.
- Data/security: No cloud/guest data removal and no Firebase identifier changes. Renamed a historical JSON file only; its contents retained via the blob SHA and Git history.
- Verification: Source inspection and GitHub tree read-back pending; build/Node tests/browser and Firebase verification NOT RUN.
- Risk/rollback: Existing links to the renamed historical JSON file would need updating, but none identified in inspected application sources; restore from Git history as needed.
- Master sections: §§2, 4, 12, 13.
- Status: IMPLEMENTED IN SOURCE, RUNTIME UNVERIFIED.

## CHG-20261021-009 | Switch guest data, settings and backup reads to DN keys
- Date (UTC): 2026-10-21.
- Requester: Repository owner (DN-only naming).
- Branch/commit: `OldVersion`; exact atomic commit in Git history; no `main` change.
- Changed paths: Auth/Guest Contexts, event/expense/income services, guest merge, Code List service, dev sample fixtures, Settings, Events, backup parser and backup tests, master and audit.
- Before -> after: Old prefixed app-owned browser keys -> `dn_` keys for active reads/writes; previously saved data copied by earlier migration before access. Legacy keys retained strictly for migration. Backup v1/v2 import accepts both generations. Successful account merge, guest exit and sample-data cleanup remove obsolete keys to prevent later reimport.
- Why: Finish compatibility-safe brand change across runtime state and prevent guest data resurrection.
- Data/security: No Firestore path/schema migration. Existing browser records never overwritten by old ones; explicit local-app-data deletion now removes both generations including dashboard favorites/recent. Original historic backup formats remain supported.
- Validation: Additional Node test created for DN-prefixed v2 backups; runtime `npm test`, `npm run build`, browser and live Firebase tests NOT RUN here.
- Risks/rollback: Compatibility logic needs real browser testing; older client versions may still expect old keys. Recover with Git history. Marked SOURCE MODIFIED, RUNTIME UNVERIFIED.
- Master: §§4.1, 4.2, 5, 13.
- Status: IMPLEMENTED IN SOURCE / VALIDATION PENDING.

## CHG-20261021-008 | Introduce non-destructive DN localStorage key migration
- Date (UTC): 2026-10-21.
- Actor/requester: Owner-directed DN brand rename.
- Branch / commit: `OldVersion`; atomic Git commit (SHA in repository history).
- Scope: `src/utils/storageMigration.js`, `src/utils/storageMigration.test.mjs`, `src/utils/codeLists.js`, `src/utils/codeLists.test.mjs`, `src/store/useAppStore.js`, `src/main.jsx`, master and audit.
- Before -> after: Preferences/Code Lists read or wrote old-prefixed browser keys -> copy old values into missing DN keys once (without deleting originals), read and write canonical DN preferences/Code Lists. Modern keys take precedence. Direct legacy code-list read also calls migration.
- Why: Change internal app branding without discarding existing browser data.
- Data/security/compatibility: Old data retained for downgrade, new canonical values never overwritten; guest/session and financial services will switch to new keys in the next commit. Only app-owned keys are eligible; modern keys win. No Firestore schema changes.
- Verification: Added four Node regression tests for copy/idempotency/clear/minimal-storage. Test execution and production build NOT RUN in this GitHub-connected environment; live Firebase NOT RUN. Source-reviewed.
- Risk/rollback: Partial migration may occur under storage quota denial, fails safely without deleting old keys. Rollback via Git commit; retain legacy values until verification.
- Master updated: §§4.1, 13.
- Status: SOURCE MODIFIED, RUNTIME UNVERIFIED.

## CHG-20261021-007 | Rename shared CSS class names to DN
- Date (UTC): 2026-10-21.
- Actor/requester: Repository owner DN-only product branding instruction.
- Branch / commit: `OldVersion`; identify atomic commit from Git history.
- Scope: `src/index.css`, `src/design-system.css`, `src/layouts/DashboardLayout.jsx`, `src/components/common/ModalDialog.jsx`, `src/pages/Events.jsx`, `docs/MASTER_SOURCE_OF_TRUTH.md` and this audit entry.
- Before -> after: Legacy CSS selector/class-name prefix and design system comments -> `dn-` / DN. All paired consumers and style definitions changed together, preserving intended presentation.
- Why: Remove deprecated internal brand naming after DN identity was approved.
- UX/data/security: CSS class identifiers changed but no domain persistence or externally stored records changed. UI regression risk until visual testing.
- Verification: Source transformations checked for remaining deprecated brand in these files. Browser, `npm test`, `npm run build`, Firebase: NOT RUN.
- Risk / rollback: Missing selector dependencies could alter styling; run mobile/desktop light/dark regression tests, rollback through Git commit if needed.
- Master section: §3.4 and version history.
- Status: SOURCE MODIFIED, RUNTIME UNVERIFIED.

## CHG-20261021-006 | Establish DN as the only authoritative product brand
- Date (UTC): 2026-10-21.
- Actor/requester: Repository owner, implementation via connected GitHub tools.
- Branch/commit/PR: `OldVersion`; this commit (Git history contains exact SHA). `main` untouched.
- Changed paths: `README.md`, `AGENTS.md`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`, `src/pages/About.jsx`, `src/App.jsx`, `scripts/deploy-hosting.mjs`, `package.json`, `package-lock.json`.
- Before -> after: Outdated product name in About UI, error fallback, release wording, package metadata and canonical docs -> **DN**; AI instructions explicitly prohibit former branding in future sessions.
- Rationale: Product owner states official app name is DN and forbids future mistaken naming.
- Data/security/compatibility: User-facing copy and package metadata only in this commit; original auth identifiers and historical storage keys not removed. CSS selectors and persistent storage keys require compatibility-aware follow-up.
- Verification: GitHub source review and branch commit; runtime build/tests NOT RUN; Firebase/deployment NOT RUN. Review final changed-file diff before release.
- Risks/rollback: App CSS classes and historical storage prefixes may still contain deprecated strings as implementation details pending safe migration. Restore this commit via Git revert if needed.
- Master sections updated: title, §2.1 product identity, §9 decisions, §10 backlog, §13 versioning.
- Status: PARTIAL BRAND MIGRATION; public-facing UI and canonical product name updated in this commit, remaining technical identifiers tracked for follow-up.
- Follow-ups: Rename remaining nonpersistent CSS classes consistently; safely migrate localStorage keys and preserve old backups; update master and append new log record. Maintain exactly four Markdown files.

## CHG-20261021-005 | Correct documentation governance scope to OldVersion only
- Date (UTC): 2026-10-21.
- Actor/requester: Repository owner clarification, implemented through connected GitHub tools.
- Branch / commit / PR: `OldVersion`; this atomic commit (SHA recorded in Git history). `main` and all other branches untouched.
- Scope and changed paths: `AGENTS.md`, `.github/workflows/documentation-governance.yml`, `README.md`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`.
- Before -> after: Earlier instructions and workflow implied all-branch governance, and workflow listened on `**` -> AI documentation/change logging applies **only to changes on `OldVersion`**; workflow triggers only on pushes to `OldVersion` and PRs whose base is `OldVersion`.
- Why: Owner explicitly rejected all-repository/branch enforcement.
- User/data/security/compatibility impact: Branch-scoping of documentation and GitHub Actions only; no application runtime or persisted user data changed. Other branches are out of scope.
- Verification: Source and GitHub branch/tree inspection completed. GitHub Actions run, `npm test`, `npm run build`, deployment and live Firebase tests: NOT RUN.
- Risk and rollback: Enforcement through GitHub Actions requires the workflow/check to be enabled and, for non-bypassable protection, required checks on `OldVersion`. Revert this commit on `OldVersion` if needed.
- Master sections updated: introduction, §§1, 7, 8, 12–13.
- Status: IMPLEMENTED (GitHub branch update subject to final read-back).
- Follow-ups: Verify GitHub Actions workflow execution and configure `OldVersion` required status checks if desired. No action on `main`.

## CHG-20261021-004 | Complete four-file documentation cleanup and verify controls
- Date (UTC): 2026-10-21.
- Actor/requester: Repository owner; implementation via authorized GitHub connector operations.
- Branch / commit / PR: `OldVersion`; final master+audit commit is this Git revision (its own SHA is available from Git history and is not embedded in its content); earlier PR #6 remained open and was **not** merged.
- Scope: Rewrote `README.md`; created `AGENTS.md`, `docs/CHANGE_AUDIT_LOG.md`, `.github/workflows/documentation-governance.yml`; rewrote `docs/MASTER_SOURCE_OF_TRUTH.md` based on source. Removed the retired docs listed below, all on `OldVersion`.
- Before -> after: 20 redundant/historical source documents beyond the four planned Markdown files -> **exactly four active Markdown files and zero Word docs**. Original material remains available in Git history.
- Rationale: Enforce one canonical source for app behavior, one prospective planning section, mandatory AI instructions and a complete append-only change register without competing PRDs/memory/task specs.
- Application behavior/data impact: **None**: no `src/` app source, dependencies or Firebase config modified; no deployment, merge or runtime migration. GitHub Actions documentation governance workflow added; its live operation has not yet been observed in an Actions run.
- Before/after version: Master **2.0.0 -> 2.0.1**; `README.md` becomes an orientation-only pointer.
- Deleted paths / exact deletion commits:
  - `docs/ARCHITECTURE.md`: `fca658b40b24017805579ddfd22d572f892fe077` (earlier CHG-002).
  - `memory.md`: `e8f107961515746a29cc9cdcd60f1e3a654d9e1b` (earlier CHG-002).
  - `BUSINESS_GUIDE.md`: `fb89178d4a08b9a0d2db3d283f7d0eb4bb61d4c3`.
  - `architecture.md`: `5d6ebb453a460a0ba978f2697a80e58e42773c84`.
  - `design.md`: `2cdc8427883b1d880a2d064b36f50955b7e116aa`.
  - `docs/AI_READY_KNOWLEDGE_BASE.md`: `80cc2137f8c32be38938383798b6d8eaf8d33770`.
  - `docs/ARCHITECTURE_REVIEW.md`: `05e00f7bd5789bf90d268c32e295fcca5f09f9ef`.
  - `docs/BACKUP_RESTORE_REVIEW.md`: `5d65389388569b8094b332fbda4b9c19b9d5e445`.
  - `docs/CODE_LIST_PERSISTENCE.md`: `e1a5237a8d70fa70c95bea47f791dc4223d2eb4c`.
  - `docs/CONSOLIDATION_SUMMARY.md`: `bea0785cc65aa198115892e110089d56fa22fefe`.
  - `docs/DOCUMENTATION_STANDARDS.md`: `723c316442e9892a5eb61c31082da1fd8a86d2f3`.
  - `docs/DUPLICATE_OBSOLETE_REPORT.md`: `73b80dbfd1dcc46b72a4910ce5d3f7df510a236f`.
  - `docs/RETENTION_DELETION_MATRIX.md`: `20dc21e45fa08c882759f81f5f316fa3c4f89320`.
  - `prd.md`: `e2b3456e866e7e46c4255f23ac750704d5ba662f`.
  - `rules.md`: `3214178187581f835cd863d3fe8615d6e6eaab0d`.
  - `tasks.md`: `315aa52e82fba50e8cefedcd7a74be3340d2a4f9`.
  - `Bugs_OCT26/New Microsoft Word Document.docx`: `bcfea1e10f7bf10b815da7523be1fd57df7c5099`.
  - `Bugs_OCT26/~$w Microsoft Word Document.docx`: `4dad079011fadea851220470f3662813190b5138`.
  - `LifeHub_Product_Spec_and_User_Guide.docx`: `3cc792c3607cc5f7a73a511e1198c365fd5e1bef`.
  - `LifeHub_System_Overview.docx`: `a47d4603c98a9f2d0f6ee603a12ca372d9c506e0`.
- Validation and evidence: GitHub recursive tree listed only `AGENTS.md`, `README.md`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md` as Markdown, no DOCX; PASS (prior to this documentation-only finalization). `main` head stayed `5b056933287e6b3f6fc5f3e62d5f6b6ce439b543`; PASS. Source inspection of stores/services/routes/backup; PASS. **Automated tests/build: NOT RUN** because no executable repository checkout was available. **Live Firebase authorization/recovery: NOT RUN. GitHub Actions governance execution: NOT RUN / not verified**.
- Risks and rollback: Unread DOCX files might contain unique old requirements; recover via Git history at `f5919b8` and reconcile when needed. CI only enforces documented diffs/audit preservation when GitHub Actions is enabled; require the check in branch protection to prevent bypass. Individual intermediate cleanup pushes may have failing documentation checks; final combined master+audit revision aligns with the policy.
- Master sections updated: §1, §8, §11, §12, §13.
- Status: **IMPLEMENTED — working-tree cleanup verified**; runtime quality and CI execution remain open.
- Follow-ups: Enable required GitHub check, validate Actions, execute `npm test` and `npm run build`, audit Firestore security rules, recover historical Word content only if a need emerges.

## CHG-20261021-003 | Source-based four-document governance reset
- Date (UTC): 2026-10-21.
- Actor/requester: Repository owner's request to retain only 3–4 documentation Markdown files and mandate a logged entry for every app change.
- Branch / commits: `OldVersion`; this entry is written ahead of final cleanup, so exact cleanup commits are captured by Git history and subsequent reconciliation entry.
- Scope: `AGENTS.md`, `README.md`, `docs/MASTER_SOURCE_OF_TRUTH.md`, `docs/CHANGE_AUDIT_LOG.md`, plus automated docs-diff workflow; removal of redundant historic documents where permitted.
- Before -> after: Multiple competing active specs -> four-file documentation policy, source-inspected master and mandatory prospective audit log.
- Why: Preserve a single AI-friendly factual reference plus separate immutable-style change trace and enforceability.
- App/data/security impact: No app behavior or data changes; workflow can block undocumented PRs/pushes. Does not verify deployed Firestore Rules.
- Verification: Connected GitHub source inspection done; GitHub writes and final inventory to be checked. `npm test` and `npm run build` NOT RUN (no checked-out executable repository in this runtime).
- Risk/rollback: Deleting unread DOCX from working tree can hide historic unique information; Git history remains recovery source. Branch protection/enabled Actions needed for robust CI enforcement.
- Master sections: Current state, source traceability, gaps, backlog, version/governance.
- Status: PARTIAL until end-of-task inventory/verification; completion should be recorded in follow-up log entry.
- Follow-ups: Read any archived DOCX from Git history if resolving historic requirements; run tests and enable required governance check in branch protections.

## CHG-20261021-002 | First historical-document cleanup
- Date (UTC): 2026-10-21.
- Actor/requester: Repository owner cleanup request.
- Branch / commits: `OldVersion`; deleted `docs/ARCHITECTURE.md` via `fca658b40b24017805579ddfd22d572f892fe077`; deleted `memory.md` via `e8f107961515746a29cc9cdcd60f1e3a654d9e1b`; later updated README/master/retention matrix.
- Before -> after: Both redundant files present -> removed from working branch, content recoverable from Git history.
- Why: Master supersedes duplicated architecture and dated session memory.
- Impact: Documentation only; no app code change; references in earlier generated reports may be stale.
- Verification: GitHub tree subsequently showed both paths absent, PASS. Tests/build NOT RUN.
- Risk / rollback: Historical prose no longer visible on branch; recover with Git history if needed.
- Status: IMPLEMENTED. Four other attempted deletions were blocked by tool safety checks at that time.

## CHG-20261021-001 | Establish consolidated documentation baseline
- Date (UTC): 2026-10-21 (exact operation timestamps not separately recorded).
- Actor/requester: Repository owner request; implemented via connected GitHub tools.
- Branch / commits: `OldVersion`; five generated documents committed individually: `76b6c560`, `f75223ee`, `ff11f70c`, `0ad67143`, `a8e28f6c`; README link updates followed.
- Scope / paths: Initial `docs/MASTER_SOURCE_OF_TRUTH.md`, duplicate report, summary, retention matrix, AI-ready KB; README link.
- Before -> after: Scattered competing documentation -> initial primary governance reference plus provenance reports.
- Why: Eliminate conflicting current-state claims and give AI maintainers consistent definitions.
- Impact: Documentation only; no application runtime modification.
- Verification: GitHub file creation and branch read-back PASS; application tests/build NOT RUN; DOCX content extraction NOT AVAILABLE.
- Risk / rollback: Some historic narrative duplicates were retained; prior commits preserve all content.
- Status: IMPLEMENTED for documentation only.
