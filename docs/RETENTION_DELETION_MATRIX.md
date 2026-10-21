# Document Retention / Deletion Matrix
**Version:** 1.0.0 | **Date:** 2026-10-21
**Policy:** Canonical master is the only normative reference; supporting records are evidence or procedural material. Git history provides an audit trail, but deletion is not warranted for unread or unique content. **Recommended ≠ executed.**

| Document | Decision | Reason | Execution state |
|---|---|---|---|
| `docs/MASTER_SOURCE_OF_TRUTH.md` | KEEP, canonical | Definitive entry point | Created |
| `docs/AI_READY_KNOWLEDGE_BASE.md` | KEEP, generated companion | AI ingestion | Created |
| `docs/DUPLICATE_OBSOLETE_REPORT.md` | KEEP | Audit trace | Created |
| `docs/CONSOLIDATION_SUMMARY.md` | KEEP | Consolidation evidence | Created |
| `docs/RETENTION_DELETION_MATRIX.md` | KEEP | Lifecycle authority | Created |
| `README.md` | KEEP, short landing | Repository navigation and setup | Retained |
| `BUSINESS_GUIDE.md` | RETIRE recommended | Repeats product overview | Deletion blocked by safety checks; retained |
| `architecture.md` | ARCHIVE recommended | Duplicate architecture and some detailed unique mappings | Deletion blocked by safety checks; retained |
| `design.md` | KEEP, specialized | Token specifics | Retained |
| `docs/ARCHITECTURE.md` | DELETE completed | Duplicate current architecture now covered by master | Deleted on `OldVersion`: `fca658b40b24017805579ddfd22d572f892fe077` |
| `docs/ARCHITECTURE_REVIEW.md` | KEEP, historical evidence | 2026-10-19 full risk/target analysis | Retained |
| `docs/BACKUP_RESTORE_REVIEW.md` | KEEP, specialist evidence | Detailed recovery and test requirements | Retained |
| `docs/CODE_LIST_PERSISTENCE.md` | KEEP, migration evidence | Unique migration details; obsolete v2 statement superseded | Retained |
| `docs/DOCUMENTATION_STANDARDS.md` | ARCHIVE recommended | Rules now in master/engineering standards | Deletion blocked by safety checks; retained |
| `memory.md` | DELETE completed | Historic context consolidated; prior version retained in Git history | Deleted on `OldVersion`: `e8f107961515746a29cc9cdcd60f1e3a654d9e1b` |
| `prd.md` | KEEP pending product sign-off | Acceptance detail | Retained |
| `rules.md` | KEEP, engineering supplement | Concrete coding conventions | Retained |
| `tasks.md` | KEEP, operational tracker | Mutable backlog and verification | Retained |
| `LifeHub_Product_Spec_and_User_Guide.docx` | HOLD FOR REVIEW | Binary source unread | Retained |
| `LifeHub_System_Overview.docx` | HOLD FOR REVIEW | Binary source unread | Retained |
| `Bugs_OCT26/New Microsoft Word Document.docx` | HOLD FOR REVIEW | Potentially active bug evidence, unread | Retained |
| `Bugs_OCT26/~$w Microsoft Word Document.docx` | DELETE recommended | Office temporary lock, 162 bytes | Deletion blocked by safety checks; retained |

**Release gate:** Do not call the knowledge base fully exhaustive until Word files are read. For later retirement, validate links, unique information, legal/audit retention and product-owner approval; then remove one path at a time from `OldVersion` and update this execution ledger with commit SHA.

## Cleanup execution history
- 2026-10-21: Deleted `docs/ARCHITECTURE.md` in `fca658b40b24017805579ddfd22d572f892fe077`.
- 2026-10-21: Deleted `memory.md` in `e8f107961515746a29cc9cdcd60f1e3a654d9e1b`.
- 2026-10-21: Four other deletion operations were blocked by safety checks; those files remain present. No DOCX source was removed.
