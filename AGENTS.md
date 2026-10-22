# DN development and documentation rules — OldVersion

**PERMANENT PRODUCT NAME: DN.** Use DN in product labels, new code, answers and documentation. Old identifiers may remain only for stored-data compatibility or historic evidence, never as alternate branding.

These rules apply to `OldVersion` in `Divin-kumar/DN_APP_MAIN`, not other branches/repositories. Explicit owner instructions take precedence. Inspect branch/SHA/tree before editing, preserve unrelated changes and handle concurrency. Do not switch branches, commit, push, merge or deploy without authorization. Protect `main` and business data.

## Documentation authority and inventory

1. [docs/MASTER_SOURCE_OF_TRUTH.md](docs/MASTER_SOURCE_OF_TRUTH.md) is the single authority for current behavior, architecture, routes, data flow, storage, configuration, constraints and verification limits.
2. [README.md](README.md) provides setup and the documentation index. Link to the master rather than duplicate application descriptions.
3. `AGENTS.md` defines mandatory development/documentation rules. Every future coding agent must read it, the master and relevant source before modifications.
4. [docs/CHANGE_AUDIT_LOG.md](docs/CHANGE_AUDIT_LOG.md) records change evidence, with the latest change first under the owner's explicit 2026-10-22 instruction. Add new entries immediately below its introduction, ordered by descending CHG date/sequence. Preserve all prior entry text; correct an older claim in a new top entry. The log is historical evidence, not current product truth or a second operating policy.

Retain the existing four-file inventory. Put documentation rules here instead of creating `docs/DOCUMENTATION_RULES.md`; the brand/inventory test and CI whitelist require exactly these four Markdown files. Do not add duplicate architecture, plan, memory or behavior documents. A necessary supporting document needs explicit approval and coordinated inventory-check changes, and must defer shared behavior to the master.

## Required workflow for every development task

1. **Inspect first.** Check branch, SHA and working tree. Preserve unrelated changes/untracked files. Check the remote branch before writes when available and handle concurrency; otherwise disclose that remote freshness is unknown. Read relevant documentation and trace actual handlers, callers, stores/services, calculations and configuration. A filename, comment or component's existence does not prove reachability.
2. **Identify the change.** Establish observed current behavior, intended resulting behavior and affected domains. Identify documentation that would become inaccurate. Separate source-derived facts from requirements and assumptions.
3. **Implement within authorization.** Preserve stable IDs, guest/account boundaries, nested links, compatibility and recovery behavior. Do not destroy data, force-push, alter protected branches or deploy without explicit permission. Never expose secret values.
4. **Document in the same task/change set.** Update the master whenever behavior, architecture, routes, data flow, storage, configuration or important constraints change. Update README or these rules when setup, usage, troubleshooting, testing, operations or process changes. Record the change and actual verification in a new top changelog entry. For internal changes update impacted constraints/verification facts; explain a no-documentation-impact conclusion when no documented fact changes. Code comments do not fully document a feature.
5. **Describe the resulting present state.** Replace obsolete descriptions instead of accumulating previous implementations, invented rationale or version narratives. Document reachable behavior and limits with source references. Introduce no duplicate source of truth.
6. **Verify agreement.** Compare routes/redirects to definitions, calculations to call sites, interactions to handlers/callers, persistence to service paths, backups to parser and restore orchestration, and PWA claims to registration/worker configuration. Check contradictions, Markdown links/anchors and inventory.
7. **Run applicable validation.** Use existing tests/build and relevant browser/account/guest/sample/failure checks where available. Record exact commands and actual outcomes. Honor task restrictions on installation and scope. Source-text/utility tests do not prove browser/device/cloud behavior. Missing dependencies and failed checks are never passes.
8. **Disclose limitations.** Identify verified execution, implementation-derived behavior and unverified behavior. Report failures, environmental limits and unresolved questions. If documentation cannot be updated, name exactly what remains outdated and why; report incomplete status. No behavioral/architectural change may knowingly leave the master outdated without that disclosure.
9. **Review the final diff.** Confirm authorized scope, preserved unrelated work and valid links/inventory. Report changed files, reviewed SHA, validation, risks and commit/push/deploy status. Do not invent an uncommitted change's SHA.

## Evidence and completion standard

- **Verified by execution:** name the command/journey and actual result, limiting claims to what was exercised.
- **Implementation-derived:** traced source behavior without end-to-end execution.
- **Unverified:** insufficient evidence/access; specify what remains missing.

No coding agent may invent behavior, claim passing tests without evidence, infer secure deployed rules from client paths, or promise complete recovery/offline sync/file storage without implementation and validation. Documentation must accompany the corresponding implementation change set; tests and comments do not replace it. Changes to these rules require explicit owner direction.

## Automated enforcement

`src/brandIdentity.test.mjs` checks DN identity and exactly four Markdown paths in `npm test`. `.github/workflows/documentation-governance.yml` requires changed master/changelog files on each `OldVersion` push/PR and runs npm ci/test/build. `scripts/check-audit-log.mjs` compares entries with the base commit: previous CHG identifiers and entry text must remain, entries must be newest first, and at least one new entry must precede the historical records. Line endings and separating trailing whitespace are normalized for comparison. Existing entries may be reordered as intact records, never silently edited or removed.

The owner's latest-first changelog instruction supersedes the former no-new-history policy and the old append-at-bottom check. Keep the master focused on the resulting present state and the changelog focused on evidence for changes. Do not weaken historical preservation or bypass CI to change log ordering. Branch protection and server-enforced data security require their own verification; these documentation checks do not establish them.
