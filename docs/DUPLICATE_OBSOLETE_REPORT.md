# Duplicate & Obsolete Document Report
**Version:** 1.0.0 | **Audit date:** 2026-10-21 | **Branch:** `OldVersion`
**Basis:** all 13 Markdown documents were read at `f5919b8`; four DOCX paths were inventoried but binary text extraction was not available in the connected GitHub reader. Technical contradictions were spot-checked against selected source files. Not a line-by-line code audit.

## Inventory and disposition
| File | Content overlap / finding | Disposition |
|---|---|---|
| `README.md` | Broad product, architecture, workflow duplication | Keep as lightweight repository landing page; master is normative |
| `BUSINESS_GUIDE.md` | Product module definitions repeat README/PRD | **Recommended retirement** after confirming no unique stakeholder content |
| `architecture.md` | Describes current architecture; overlaps `docs/ARCHITECTURE.md` | Recommended archive once unique data/schema details checked |
| `design.md` | Detailed design tokens/layout rules not fully repeated elsewhere | Retain as specialized reference; master governs policy |
| `docs/ARCHITECTURE.md` | Strong overlap with README, architecture.md and architecture review | Recommended archive after validation |
| `docs/ARCHITECTURE_REVIEW.md` | Comprehensive 2026-10-19 risk analysis and proposals; not a current-state spec | Retain as **historical audit evidence**, explicitly non-normative |
| `docs/BACKUP_RESTORE_REVIEW.md` | Deep implementation and recovery risks | Retain specialist test/audit evidence; v3 overrides v2 prose |
| `docs/CODE_LIST_PERSISTENCE.md` | Migration note includes old v2 export description | Retain as migration evidence; **obsolete v2-current claim superseded** |
| `docs/DOCUMENTATION_STANDARDS.md` | Comment standards subsumed by master and rules.md | Recommended archive after updating references |
| `memory.md` | Repeats architecture/rules/task states, mixes historical session log | Retain as dated history only; not alternative AI instruction authority |
| `prd.md` | Detailed product features overlap README/business guide | Retain temporarily for acceptance detail; master governs current claims |
| `rules.md` | Engineering standards and guardrails | Retain as code-specific procedural reference |
| `tasks.md` | Mutable status and historic log mixed with requirements | Retain for execution tracking, not source of product truth |
| `LifeHub_Product_Spec_and_User_Guide.docx` | Contents not readable from connector | **Review required; no deletion** |
| `LifeHub_System_Overview.docx` | Contents not readable from connector | **Review required; no deletion** |
| `Bugs_OCT26/New Microsoft Word Document.docx` | Contents not readable; may hold unresolved bugs | **Review required; no deletion** |
| `Bugs_OCT26/~$w Microsoft Word Document.docx` | 162-byte Office temporary lock artifact, not substantive documentation | **Recommend delete** (after checking no active editing session); deletion outcome in matrix |

## Specific duplicates and conflicts
1. **Product descriptions** repeated by README, BUSINESS_GUIDE, PRD and docs/ARCHITECTURE. Resolution: master §2 owns canonical feature inventory; PRD remains detail/evidence.
2. **Architecture/persistence descriptions** repeated by README, architecture.md, docs/ARCHITECTURE and ARCHITECTURE_REVIEW. Resolution: source-inspected Firebase/guest architecture; IndexedDB/local-first is target option only.
3. **Documentation conventions** repeated by DOCUMENTATION_STANDARDS, rules.md and memory.md. Resolution: master §6 governs; rules.md remains detailed developer guide.
4. **Task/verification state** repeated by tasks.md, memory.md and enterprise review. Resolution: tests and operational checks not marked verified without evidence.
5. **Backup v2/v3:** docs/CODE_LIST_PERSISTENCE describes v2 export, but current `src/services/backupService.js` declares v3. Resolution: v3 current, v2 legacy migration.
6. **Naming:** LifeHub and DN mixed. Resolution: keep both with explicit roles until a branding decision.
7. **Security/offline:** user-centric documents can imply dependable storage, but deployed rules and durable offline sync are unverified. Resolution: state limitations and release blockers.

## Actual removal ledger
Document removals are recorded in the [retention matrix](RETENTION_DELETION_MATRIX.md). **No substantive Markdown or unreadable DOCX source is authorized for automatic deletion on the strength of partial binary coverage alone.** Proposed removals are not represented as completed.
