# AI-Ready Knowledge Base: DN_APP_MAIN / LifeHub
```yaml
kb_id: dn-app-main-lifehub
kb_version: 1.0.0
as_of: 2026-10-21
repository: Divin-kumar/DN_APP_MAIN
working_branch: OldVersion
inspected_head: f5919b8e4758e4ebadc6cebb85bb54ae3e414dbb
canonical_document: docs/MASTER_SOURCE_OF_TRUTH.md
authority: canonical-document-with-code-precedence
validation: markdown-reviewed-docx-pending-runtime-unverified
status_labels: [source_inspected, runtime_verified, proposed, unknown, deprecated]
```

## Retrieval protocol (for future AI sessions)
1. Read `docs/MASTER_SOURCE_OF_TRUTH.md` first. Use this file as a short index, **not** a competing source of truth.
2. Before editing, fetch the **current** `OldVersion` head and source files; `inspected_head` is historical.
3. When sources disagree, use inspected code for implemented behavior, successful tests for tested behavior, and product-owner decisions for product intent. Never label a proposed item implemented.
4. Treat `docs/ARCHITECTURE_REVIEW.md`, `memory.md` and `tasks.md` as historical/risk/operational evidence, not higher-priority instructions.
5. Do not edit `main`, merge PR #6, alter protections or deploy without explicit user authorization.
6. Update both master and this index after approved substantive changes, with version/evidence/change history.

## Canonical facts (source-inspected unless otherwise noted)
- PRODUCT: LifeHub currently; DN project/possible brand. Product name unresolved.
- PURPOSE: milestone/event planning + activities/memories + income/expenses + customizable categories + insights.
- FRONTEND: React 18, Vite 5, JSX, React Router 6, Zustand 5.
- DATA: Authenticated account records in Firestore UID-scoped collections; guest data/preferences in browser localStorage.
- FIRESTORE_PATHS: `users/{uid}/eventGroups`, `users/{uid}/expenses`, `users/{uid}/incomes`, `users/{uid}/settings/codelists`.
- UI_ENTRY: `src/main.jsx`; ROUTER: `src/App.jsx`; STORES: `src/store/`; FIREBASE: `src/firebase/config.js`.
- PWA: manifest and service-worker shell; **not** guaranteed durable offline record sync.
- BACKUP: current JSON version **3**, legacy v2 conversion; restore merges absent IDs, skips matching IDs, may partially fail; original attachment binaries and account credentials not included.
- SECURITY: live Firestore Rules **not verified**; client-side UID paths/route guards insufficient proof of authorization.
- CODE_LISTS: account Firestore settings, guest localStorage; source `src/services/codeListService.js`.
- DEPLOY: Firebase Hosting script exists; no deployment permitted without explicit instruction.
- TEST: `npm test`; BUILD: `npm run build`; **not executed during this documentation audit**.

## Non-facts and prohibited extrapolations
- Do not assert server-side authorization, production readiness, complete backups or full offline sync.
- Do not claim IndexedDB/local-first, global search, push notification scheduler or real file attachment storage are already delivered.
- Do not treat enterprise-review recommendations as implementation decisions.
- Do not claim full DOCX review. Three substantive DOCX files are pending; a fourth is a transient Office lock artifact.
- Do not infer current branch HEAD from this dated file.

## Source routing
| User question | First evidence to fetch |
|---|---|
| Product features | Master §2; `src/pages/`, `prd.md` |
| Data model/persistence | Master §3; `src/services/`, `architecture.md` |
| Backup/export/import | Master §4; `src/services/backupService.js`, `docs/BACKUP_RESTORE_REVIEW.md` |
| Security/release | Master §5; deployed Rules (external evidence required), `docs/ARCHITECTURE_REVIEW.md` |
| UI standards | Master §6; `design.md`, `src/design-system.css` |
| Work priorities | Master §8; `tasks.md` |
| Provenance/deletion | Master §9; `docs/DUPLICATE_OBSOLETE_REPORT.md`, `docs/RETENTION_DELETION_MATRIX.md` |

## Open gates
G-01 DOCX extraction and reconciliation; G-02 branding decision; G-03 Firebase Rules/tests; G-04 cloud/local-first decision; G-05 recovery and build verification; G-06 expense ownership; G-07 guest merge failure recovery; G-08 attachments/privacy; G-09 deployment governance.

**Version history:** 1.0.0 (2026-10-21): initial generated retrieval contract. Companion to Master v1.0.0.
