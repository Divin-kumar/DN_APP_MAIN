# Mandatory AI Operating Contract — DN_APP_MAIN / OldVersion

**PERMANENT PRODUCT NAME: DN, explicitly confirmed by the owner. All future AI sessions working on `OldVersion` MUST use DN in product labels, answers, requirements, user-facing content and code.** Always call the application **DN**, never **LifeHub**, in future AI sessions, answers, user-facing labels, code additions, PR titles, plans and documentation. The old product name is **deprecated and incorrect**. Older internal strings may exist solely as compatibility keys for previously stored user data, legacy backup tests and historic Git evidence; they are **never product branding**. If you encounter older naming in source, prefer DN and update the canonical master and audit entry with the correction.

**Scope: `OldVersion` branch of `Divin-kumar/DN_APP_MAIN` only.** These mandatory AI/change-control rules **do not apply to `main`, any other branch, or other repositories.** For factual product/application truth, read [docs/MASTER_SOURCE_OF_TRUTH.md](docs/MASTER_SOURCE_OF_TRUTH.md) before edits. This document is not a replacement for verification of current code.

## 0. Repository documentation budget
**Strict DN branding and documentation gate:** No AI may add the retired app name to user-visible content. New or changed UI source must name the product DN. Never create a fifth Markdown file on `OldVersion`, including `.markdown` or case variants: add all proposed features, designs, decisions, tasks, specs and plans to the Master, and all executed work to the audit log. The only old-prefix exception is data compatibility, not a second product identity. `src/brandIdentity.test.mjs` checks these rules in `npm test`.

Only four Markdown files are authorized in the `OldVersion` working tree:
1. `README.md` — short entry point and run commands.
2. `AGENTS.md` — this mandatory AI change-control contract.
3. `docs/MASTER_SOURCE_OF_TRUTH.md` — authoritative current state, architecture, constraints, decisions and planned backlog.
4. `docs/CHANGE_AUDIT_LOG.md` — append-only history of every change.
Do not add `tasks.md`, `memory.md`, additional PRDs, design notes, duplicate specs or scattered Markdown. Put approved future plans in the Master's **Planned/Unverified Backlog** section. Log every executed change in the audit log. Historical originals remain retrievable from Git commits when deleted.

## 1. Non-negotiable rule: no undocumented change
**For EVERY change on `OldVersion`** (feature, bug fix, refactor, styling, dependencies, schema, code, tests, config, infrastructure, documentation or deployment script):
- Inspect source behavior first and distinguish observed implementation from assumptions.
- Update `docs/MASTER_SOURCE_OF_TRUTH.md` in the **same change/PR**: impacted functionality or architecture, data flows, domain invariants, risks, compatibility, and verification status. If a change is purely internal and has no user-facing behavior, record its internal implications.
- **Append a new uniquely identified entry** to `docs/CHANGE_AUDIT_LOG.md` in the **same change/PR**, even when tests fail or the work is incomplete. Never silently rewrite or delete an old entry; correct it with a subsequent entry.
- Each entry includes UTC date, actor, branch, change summary, rationale, exact changed paths, observed before/after behavior, data/UX/security implications, test commands and actual outcomes (or NOT RUN), commit/PR reference when known, risk and rollback, and planned follow-ups. If the commit SHA is not yet available, say `pending commit` and backfill in the next audit entry rather than falsely inventing one.
- For documentation-only cleanup or governance changes, append the same audit entry and update master version and inventory.
- Do **not** label code inspection as runtime validation or claim production Firebase Rules were tested without evidence.
- Every change to `OldVersion` must include a documentation diff. The workflow under `.github/workflows/documentation-governance.yml` checks **only pushes to `OldVersion` and pull requests targeting `OldVersion`**. It does not govern other branches or repositories. Workflow checks are **not** a substitute for branch protection/review.

**Definition of done for `OldVersion`:** code implemented; relevant tests/build executed (or failures/limitations explicitly recorded); master and audit log updated; no unsupported claims; user-facing summary lists changed files, SHA and validation. A change lacking documentation remains **INCOMPLETE**, even if code runs.

## 2. Branch and deployment rules
- Current development target is exactly `OldVersion` (capital O and V); specify `branch: "OldVersion"` in GitHub writes.
- `main` is protected and must not be modified, force-pushed or merged without explicit user instruction. PR #6 is historical/open and not authorization to merge.
- Do not deploy Firebase Hosting, run destructive data migrations or delete business data without explicit authorization.
- Before writing, fetch the latest branch SHA and relevant files. Handle conflicts and concurrency; never blindly overwrite newer work.
- Avoid broad rewrites; preserve stable app IDs, guest/account separation, nested activity/expense links, migration behavior and backup compatibility.

## 3. How to evaluate truth
- **Current source at branch HEAD** > verifiable executed tests/deployed config > master (which must be updated when source changes) > historical Git docs.
- Distinguish **Source-inspected**, **Runtime-verified**, **Planned**, **Unknown**, **Deprecated**.
- Existing implementation: React/Vite, Router, Zustand, Firebase Auth+Firestore, guest localStorage; backup JSON v3; PWA shell cache.
- Do not invent durable offline data synchronization, secure deployed Firestore Rules, original binary attachment storage, comprehensive automatic backups or completed roadmap features.
- Validate changes in account, guest and sample/demo modes where relevant; check failure/recovery cases. Never expose secret values.

## 4. Execution sequence for AI sessions working on `OldVersion`
1. Read `AGENTS.md`, `docs/MASTER_SOURCE_OF_TRUTH.md` and the latest entries in `docs/CHANGE_AUDIT_LOG.md`.
2. Refresh current `OldVersion` code/tree and user goal. State affected domains and planned verification.
3. Implement only authorized changes on `OldVersion`, with tests/guardrails.
4. Update master + append audit entry **before completing the task**; update version/changelog in master.
5. Inspect diff, run applicable `npm test`, `npm run build` when available, and report real outcomes and any missing checks.
6. Verify branch state, then summarize changed paths, open risks and log entry ID.

## 5. Audit record schema (mandatory)
```text
### CHG-YYYYMMDD-NNN | <summary>
- Date (UTC):
- Actor/requester:
- Branch / commit / PR: 
- Scope and changed paths:
- Before -> after:
- Why:
- User/data/security/compatibility impact:
- Verification (exact commands, PASS/FAIL/NOT RUN):
- Risk and rollback:
- Master sections updated:
- Status: IMPLEMENTED / PARTIAL / REVERTED / PROPOSED (proposals live in master, not as executed code)
- Follow-ups:
```

## 6. Governing changes to this contract
Changing or removing these `OldVersion`-specific requirements requires explicit user direction and an `OldVersion` audit-log entry. Even if a requested task is only an answer, do not claim that it changed files if no GitHub write occurred.
