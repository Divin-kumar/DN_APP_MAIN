# DN — OldVersion-only development rules

**PERMANENT PRODUCT NAME: DN.** Use DN in code, UI and documentation. Old identifiers are for data compatibility or history only.

**CURRENT OWNER INSTRUCTION (31 October 2026, reaffirmed):** Implement ALL new DN changes on **`OldVersion` only** in `Divin-kumar/DN_APP_MAIN`. Never write, commit, push, merge or open a PR against `DN-2.1-batch2`, `main`, the checkpoint, or another branch. Never create a new development branch unless the owner explicitly changes this instruction. Historical branch policies below are superseded wherever they conflict. Do not deploy to Firebase or Vercel without separate approval.

**ABSOLUTE MAIN BRANCH PROTECTION:** `main` remains frozen, read-only and never a PR target. `OldVersion` alone is the authorized implementation branch. `DN-2.1-batch2` and the pre-Apple checkpoint are read-only historical branches. Do not delete, reset, merge or modify them. No PRs, deployment or release actions without separate owner approval. Verify that every GitHub write explicitly specifies `branch: OldVersion`; never allow a default-branch write.

**STANDING OWNER WORKFLOW (31 October 2026):** Commit and push reviewed in-scope work to `OldVersion` only, preserving unrelated work and verifying the latest branch head before each write. The previous Batch-2 work was integrated into `OldVersion` (see Master CHG-233), so it is not an active implementation branch. Owner review and batch publication happen on Firebase only after explicit authorization. Do not depend on Vercel previews/limits for manual acceptance; do not request paid upgrades. Keep a clear pending-release ledger with exact code SHA, actual test evidence and known risks. Firebase Hosting publication, app-version changes, merges and destructive data actions still require separate owner authorization.

## Authority and inventory

Keep exactly five approved Markdown files:

- [Master](docs/MASTER_SOURCE_OF_TRUTH.md): current product behavior, architecture, data and limits.
- [README](README.md): setup, commands and documentation index.
- `AGENTS.md`: development rules.
- [Change log](docs/CHANGE_AUDIT_LOG.md): completed changes, releases and historical decisions, newest first.
- [Business guide](docs/DN_BUSINESS_GUIDE.md): owner-facing, strictly nontechnical summary of current features, limitations and proposed improvement checklist. Derived from the master, not a competing specification; future suggestions are not approval to implement.

The owner explicitly approved the fifth business guide. Keep it aligned when user-facing facts change; agents need not load it for routine coding when the master answers the question. No other duplicate specifications, plans or memory files. Further documents require owner approval and inventory-check changes. Source outranks documentation; correct disagreements with the corresponding change.

## Workflow

1. Check `OldVersion` branch/SHA/tree and remote freshness before writes; preserve unrelated/untracked work and disclose unavailable checks. Commit scoped changes **only to `OldVersion`**, always passing its explicit branch name. Any other branch write, merge, PR, deployment or destructive data operation requires separate owner authorization. Protect `main`, stable IDs and guest/account boundaries; expose no secrets. An explicitly authorized Firebase deployment means permanent production Hosting unless a Firebase preview is requested.
2. Read the master first; answer documented product questions without rescanning source. Before coding, trace affected handlers/callers, stores/services, configuration and tests. Scan further only for the task or uncertainty; filenames/comments do not establish reachability.
3. Update the master alongside changes to behavior, architecture, data flow, configuration or important constraints. Update setup/process instructions when affected. Replace obsolete descriptions and avoid duplicate facts. Explain when internal work has no documentation impact.
4. Meaningful completed changes/releases need a new top CHG entry: scope, rationale, compatibility, actual validation, risks and known references. Routine documentation maintenance needs no automatic audit/master edit. Preserve earlier CHG IDs/text and newest-first order; correct history in a new entry.
5. Run applicable tests/build/journeys; check affected routes, calculations, storage, backup and links/inventory. Label evidence **Executed**, **Source-derived** or **Unverified**.
   **Guest demo maintenance:** For every user-facing feature, UI interaction or PDF change, review the versioned public Guest tour in src/dev/sampleData.js. Bump GUEST_TOUR_VERSION and update fixtures, sample images and regression tests when affected. If unchanged, document why. Never silently reset an edited tour or change personal Guest records; use explicit Refresh demo. The owner requires samples to keep pace with the application. Source/mock tests are not browser/cloud/security proof.
6. Review the diff; report paths, reviewed SHA, validation, risks and commit/push/deploy status. Invent no uncommitted SHA or recovery/synchronization guarantee.

## Enforcement

CI checks tests/build, inventory and historical preservation/order. It does not force master/changelog edits on every push or prove factual completeness; reviewers enforce the rules above. Rule changes require owner direction.
