# Immutable-Style Change Audit Log — DN_APP_MAIN
**Version:** 1.0.0 | **Initiated:** 2026-10-21 | **Working branch:** `OldVersion`
**Policy:** This log is **append-only** in intent. Every future application change, including bug fixes, refactors, CSS, dependencies, tests, configuration, data migrations and documentation governance, must append an entry in the same PR/commit as the change. Git history is the tamper-evident source of record; ordinary Markdown cannot itself prevent rewriting. See [AGENTS.md](../AGENTS.md) and [Master Source of Truth](MASTER_SOURCE_OF_TRUTH.md).
**Historical coverage limitation:** The prior repository's entire commit history has **not** been reconstructed into this file. The entries below form an evidence-linked baseline for known 2026-10-21 documentation activity and establish mandatory prospective logging.

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

## CHG-20261021-036 | Fix archived-event picker filter grouping
- Date (UTC): 2026-10-21.
- Branch/commit: `OldVersion`; exact SHA in Git history, `main` unchanged.
- Paths: `src/pages/Events.jsx`, master, audit.
- Before/after: Adding archived exclusion introduced an extra opening parenthesis in active-event activity picker expression. Closed grouping so search remains constrained to unarchived events, while Archived rail still exposes archived cards.
- Verification: Source corrected, CI/build pending. Data unchanged, no deployment.
- Risk/rollback: None beyond existing archive user flow, manual QA needed.
- Master: §§9,13, v2.9.1.
- Status: SOURCE FIXED, CI PENDING.

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

## CHG-20261021-043 | Restore scoped Code Lists in event activity drawer
- Date (UTC): 2026-10-21.
- Branch: `OldVersion` only, main unchanged.
- Paths: `src/pages/Events.jsx`, master, audit.
- Before -> after: Focused-event drawer referenced `adminValues` without an in-scope binding after extracting the event/activity-only drawer; now reads canonical Code Lists from `useAppStore` within the component. This prevents priority selector runtime ReferenceError and preserves existing activity editing.
- Verification: Source review; CI/build pending. Browser activity editing NOT RUN.
- Data: No persisted event or financial records changed.
- Risk/rollback: Same UI semantics, no schema change. Revert commit if necessary.
- Status: SOURCE FIXED / QA PENDING.

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

## CHG-20261021-064 | One-line financial totals and swipe reliability repair
- Date (UTC): 2026-10-21.
- Actor/requester: DN owner, UI bug report.
- Branch: OldVersion only; main unaffected. No deployment or stored data changes.
- Paths: src/design-system.css, src/components/common/SwipeActionCard.jsx, src/components/financials/TransactionHistory.jsx, src/utils/premiumUxContract.test.mjs, docs/MASTER_SOURCE_OF_TRUTH.md, docs/CHANGE_AUDIT_LOG.md.
- Before -> after: Narrow Finance breakpoints split Balance onto a second row; now all three cards stay on one responsive row. Transaction drag-end referenced removed resolver causing runtime swipe failure; corrected. Moment swipe release uses pointer gesture intent rather than gesture-library drag tracking. Code List row transform disabled, actions animate on top of a stationary row.
- Validation: New source-contract tests; npm test/build and governance pending GitHub CI. Manual browser/swipe/performance QA not run.
- Risk/rollback: Very narrow widths may wrap currency figures; swipe click suppression and Code List overlay behavior need device review. Revert this commit to roll back. No migration.
- Master: §9.1 and §13, version 2.13.1.

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
