# Merge and Consolidation Summary
**Version:** 1.0.0 | **Date:** 2026-10-21 | **Canonical output:** [MASTER_SOURCE_OF_TRUTH.md](MASTER_SOURCE_OF_TRUTH.md)

## Scope and method
1. Enumerated all 125 repository tree entries; identified 13 Markdown documents, 4 DOCX files, and code/config references relevant to documentation.
2. Read all 13 Markdown documents and inspected source files including `package.json`, `src/main.jsx`, `src/App.jsx`, `src/services/backupService.js`, `src/services/codeListService.js`, `src/services/guestMergeService.js` and `src/store/useAppStore.js`.
3. Inventoried Word binary files, **not text-reviewed** because the GitHub connector cannot extract DOCX content.
4. Normalized names, classified current implementation versus proposed architecture, and consolidated recurring sections into the master.
5. Preserved traceability, verification limits, change history, open questions and archival/deletion decisions.

## Merged subject areas
| Canonical area | Source documents combined | Decision |
|---|---|---|
| Product overview / screens | README, BUSINESS_GUIDE, PRD, docs/ARCHITECTURE | Current scope normalized; aspirational features not described as shipped |
| Tech architecture / data | architecture.md, docs/ARCHITECTURE, README, ARCHITECTURE_REVIEW | Firestore and localStorage current; local-first optional target |
| UI terminology | design.md, PRD, enterprise review | LifeHub runtime vs DN project; Moment UI vs eventGroup persistence |
| Backup and recovery | BACKUP_RESTORE_REVIEW, CODE_LIST_PERSISTENCE, architecture.md, code | v3 current; v2 conversion legacy; original blobs absent |
| Standards and operations | rules.md, DOCUMENTATION_STANDARDS, memory.md, tasks.md | Branch discipline, validation states, source/update policy centralized |
| Security gaps and roadmap | ARCHITECTURE_REVIEW, tasks.md, memory.md | Clear P0 evidence obligations, no unsupported security assurance |

## Key changes
- Created a normative, citation-by-path master with a hierarchical table of contents, policy, implemented behavior, risks, unresolved decisions and change protocol.
- Created a compact AI consumption layer rather than relying on repetitive, dated session notes.
- Established source precedence: code and verified operational evidence over conflicting documentation.
- Explicitly separated *implemented*, *verified*, *proposed* and *unknown*.
- Added a retention matrix and a no-unreviewed-binary-deletion safeguard.

## Limitations and next acceptance criteria
This is a **provisional comprehensive Markdown consolidation**, not a claim that unread DOCX content was analyzed. Before full certification: extract and review 3 substantive Word files, reconcile their unique requirements, check deployed Firebase Rules, run builds/tests and recovery drills, get product ownership sign-off on DN/LifeHub branding and future offline strategy. No PR merge or deployment is part of this exercise.
