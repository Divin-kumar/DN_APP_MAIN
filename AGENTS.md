# DN — OldVersion agent rules

**PERMANENT PRODUCT NAME: DN.** Use DN in code, UI and documentation. Old identifiers are for data compatibility or history only.

Scope: `OldVersion` in `Divin-kumar/DN_APP_MAIN`. Owner instructions and existing session authorization take precedence.

**ABSOLUTE MAIN BRANCH PROTECTION (owner reaffirmed 2026-10-26):** `main` is frozen and read-only. Never push, commit, edit, reset, cherry-pick, merge, or deploy changes through `main`. Never open, retarget, or merge a pull request whose **base/target is `main`**. All DN implementation, fixes, releases, and documentation changes go to `OldVersion`, or a feature/release branch whose pull-request **base is `OldVersion`**. Before creating a PR or merging, verify the base is exactly `OldVersion`; if not, stop without proceeding. This applies even if GitHub branch protection is disabled, an integration defaults to `main`, or a tool suggests `main`. Do not silently change this policy.

**STANDING OWNER WORKFLOW (updated 2026-10-31):** Commit and push completed, source-reviewed work within the owner's approved DN scope to `OldVersion`, preserving unrelated work and checking remote freshness. The owner now conducts **manual acceptance and batch releases on Firebase only**; do not use Vercel builds, previews or limits as a manual testing gate, and do not request Vercel upgrades. Existing automatic Vercel integrations may still run, but their status is not release evidence. Accumulate CHG-213 onward in a single deferred Firebase batch with explicit validation status. Firebase Hosting publication, app-version changes, deployment or scope expansion still require separate owner authorization. `main` remains frozen.

## Authority and inventory

Keep exactly five approved Markdown files:

- [Master](docs/MASTER_SOURCE_OF_TRUTH.md): current product behavior, architecture, data and limits.
- [README](README.md): setup, commands and documentation index.
- `AGENTS.md`: development rules.
- [Change log](docs/CHANGE_AUDIT_LOG.md): completed changes, releases and historical decisions, newest first.
- [Business guide](docs/DN_BUSINESS_GUIDE.md): owner-facing, strictly nontechnical summary of current features, limitations and proposed improvement checklist. Derived from the master, not a competing specification; future suggestions are not approval to implement.

The owner explicitly approved the fifth business guide. Keep it aligned when user-facing facts change; agents need not load it for routine coding when the master answers the question. No other duplicate specifications, plans or memory files. Further documents require owner approval and inventory-check changes. Source outranks documentation; correct disagreements with the corresponding change.

## Workflow

1. Check branch/SHA/tree and remote freshness before writes; preserve unrelated/untracked work and disclose unavailable checks. Use the standing OldVersion commit/push workflow above for approved work. Other branch switches, commits/pushes, merges, deployments and destructive data operations require authorization. Protect `main`, stable IDs and guest/account boundaries; expose no secrets. An explicitly authorized Firebase deployment means permanent production Hosting unless a Firebase preview is requested.
2. Read the master first; answer documented product questions without rescanning source. Before coding, trace affected handlers/callers, stores/services, configuration and tests. Scan further only for the task or uncertainty; filenames/comments do not establish reachability.
3. Update the master alongside changes to behavior, architecture, data flow, configuration or important constraints. Update setup/process instructions when affected. Replace obsolete descriptions and avoid duplicate facts. Explain when internal work has no documentation impact.
4. Meaningful completed changes/releases need a new top CHG entry: scope, rationale, compatibility, actual validation, risks and known references. Routine documentation maintenance needs no automatic audit/master edit. Preserve earlier CHG IDs/text and newest-first order; correct history in a new entry.
5. Run applicable tests/build/journeys; check affected routes, calculations, storage, backup and links/inventory. Label evidence **Executed**, **Source-derived** or **Unverified**.
   **Guest demo maintenance:** For every user-facing feature, UI interaction or PDF change, review the versioned public Guest tour in src/dev/sampleData.js. Bump GUEST_TOUR_VERSION and update fixtures, sample images and regression tests when affected. If unchanged, document why. Never silently reset an edited tour or change personal Guest records; use explicit Refresh demo. The owner requires samples to keep pace with the application. Source/mock tests are not browser/cloud/security proof.
6. Review the diff; report paths, reviewed SHA, validation, risks and commit/push/deploy status. Invent no uncommitted SHA or recovery/synchronization guarantee.

## Enforcement

CI checks tests/build, inventory and historical preservation/order. It does not force master/changelog edits on every push or prove factual completeness; reviewers enforce the rules above. Rule changes require owner direction.
