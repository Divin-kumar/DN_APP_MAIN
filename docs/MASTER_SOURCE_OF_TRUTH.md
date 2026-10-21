# LifeHub / DN — Master Source of Truth
**Version:** 1.0.0 | **Status:** Authoritative documentation baseline (source-verified with exceptions) | **As of:** 2026-10-21
**Repository:** `Divin-kumar/DN_APP_MAIN` | **Development branch:** `OldVersion` | **Inspected branch head:** `f5919b8e4758e4ebadc6cebb85bb54ae3e414dbb`
**Owners:** Product owner (product policy); engineering maintainer (technical accuracy); security owner (security sign-off, pending assignment).

> **AI entry point:** Read this document first, then [AI-ready knowledge base](AI_READY_KNOWLEDGE_BASE.md). Treat implementation source and successful runtime verification as more authoritative than prose for actual behavior. Historic review reports describe risks and proposals, not approved implementation. Do not assume this file overrides GitHub branch state or live Firebase configuration.

## 1. Authority, scope, and evidence
This document is the **single normative documentation entry point** for product scope, implemented architecture, operating boundaries and governance. Supporting deep-dive reports remain *non-normative evidence* until archived or retired. It consolidates `README.md`, `BUSINESS_GUIDE.md`, `architecture.md`, `design.md`, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE_REVIEW.md`, `docs/BACKUP_RESTORE_REVIEW.md`, `docs/CODE_LIST_PERSISTENCE.md`, `docs/DOCUMENTATION_STANDARDS.md`, `memory.md`, `prd.md`, `rules.md`, and `tasks.md`. Three substantive DOCX files and a transient Word lock file were inventoried but **their binary content could not be extracted through the connected GitHub reader**; their claims are NOT asserted here. See [review report](DUPLICATE_OBSOLETE_REPORT.md).

**Precedence for factual disputes:** (1) inspected code/config at the specified commit, (2) verified tests and runtime evidence when supplied, (3) scoped recent implementation reviews, (4) older architecture/requirements narratives, (5) aspirational design. Product policies not specified in code require owner sign-off. Never confuse code presence with successful production verification.

**Terminology:** **LifeHub** = implemented product/application name; **DN** = repository/project or prospective brand, not a completed rebrand. **Moment / Event** = user-facing life event; **event group** = current persistence entity. **Activity** = task associated with an event. **Memory** = related note/keepsake metadata. **Account** = Firebase-authenticated profile; **guest** = browser-local mode. **Backup v3** = current JSON export/restore contract.

## 2. Product and users
LifeHub is a mobile-friendly personal life and lightweight-finance workspace. Its implemented scope covers life milestones (birthdays, anniversaries, festivals, plans), linked activities, memories and attachment metadata, income and expenses, dashboard summaries, insights, configurable categories, and settings. Target users include individuals, families and guest trial users. Do **not** market it as a banking system, guaranteed reminder delivery service, full attachment vault, or production-grade sensitive-data system of record without validation and product approval.

**Functional domains**
| Domain | Implemented purpose | Primary source |
|---|---|---|
| Dashboard | Upcoming moments, tasks, financial summaries | `src/features/dashboard/components/DashboardOverview.jsx`; `README.md` |
| Moments and events | Create/organize milestones and related records | `src/features/events/components/EventWorkspaceShell.jsx`; `prd.md` |
| Activities and memories | Linked tasks and personal notes/metadata | `src/components/events/`; `prd.md` |
| Income and expenses | Record, categorize and summarize finances | `src/components/income/`, `src/components/expenses/`; `prd.md` |
| Settings and code lists | Preferences, categories, backups, import/export | `src/pages/Settings.jsx`, `src/pages/CodeLists.jsx`; `docs/CODE_LIST_PERSISTENCE.md` |
| Insights and PWA | Derived reports, installable app shell and updates | `src/pages/Insights.jsx`, `src/main.jsx`; `README.md` |

## 3. Implemented technology and boundaries
- Frontend: React 18, Vite 5, JavaScript/JSX, React Router 6, Zustand 5, plain CSS, Lucide, optional Framer Motion.
- Backend services: Firebase JS SDK 12, Firebase Authentication (Google sign-in), Cloud Firestore. Source inspection does not reveal a separately deployed custom API server.
- Entry and navigation: `src/main.jsx` mounts the app and registers the production service worker; `src/App.jsx` defines lazy-loaded public/protected routes; `src/routes/ProtectedRoute` gates account pages in the client.
- State and persistence: `src/store/` and `src/context/` coordinate UI, session and domains; `src/services/` performs persistence; authenticated records go to UID-scoped Firestore paths; guest records/preferences reside in browser localStorage.
- PWA: manifest under `public/`, production service-worker registration/version prompt; cached application shell **does not prove reliable offline data writes**.
- UI: theme uses root `data-theme`, with `src/index.css` and subsequently loaded `src/design-system.css`; test both themes and viewport sizes before broad CSS edits.
- Infrastructure: `firebase.json`, `.firebaserc`, `scripts/deploy-hosting.mjs`. Do not deploy without explicit authorization.

### 3.1 Data ownership and conceptual relationships
An **event group** represents a Moment/Event and may embed Activities, Memories, attachment metadata and nested Activity Expenses. Independent Expenses and Incomes have separate account collections. Dashboard/Insights are generally computed views, not separate persisted domain sets. Reconcile embedded expenses with standalone expense records by stable app IDs before exports or migrations. Avoid introducing two authoritative copies of the same financial transaction.

**Authenticated paths identified in source/docs:** `users/{uid}/eventGroups`, `users/{uid}/expenses`, `users/{uid}/incomes`, `users/{uid}/settings/codelists`. Browser-local keys include `lifehub_preferences`, guest domain keys and guest code-list keys. **Security Rules are not present in the inspected repository tree**; UID-scoped client paths alone are not access controls.

### 3.2 Code lists
Authenticated list configuration uses `users/{uid}/settings/codelists` with `adminValues`, `schemaVersion` and `updatedAt`; guest configuration remains local. The code-list implementation supports migration from legacy browser values, but multi-device and Rules behavior need actual Firebase tests. Source: `src/services/codeListService.js`, `src/store/useAppStore.js`, `docs/CODE_LIST_PERSISTENCE.md`.

## 4. Backup, restore and recoverability
**Current version is 3** (`CURRENT_BACKUP_VERSION = 3` in `src/services/backupService.js`). Version 2 is legacy input compatibility and must not be described as current. The v3 export includes domain records, linked child metadata, code lists and relevant app configuration. Authenticated exports draw from Firestore, guest exports from guest storage. Restore uses a review/validation process, rebuilds linked records, merges **missing stable IDs** and skips conflicting existing IDs instead of silently overwriting them. Future unsupported versions are rejected.

**Limits:** Restores are not atomic across the entire dataset; partial writes and retry may be required. Attachment metadata does not reconstruct original binary files that were never stored. Firebase Auth identities, rules, external service credentials, caches and production environment state are not backed up. The currently signed-in UID is the destination for account restores. Runtime recovery drills, Firestore Rules and multi-device behavior remain unverified. Sources: `src/services/backupService.js`, `src/services/backupService.test.mjs`, `docs/BACKUP_RESTORE_REVIEW.md`, `architecture.md`.

## 5. Security, privacy and production readiness
**Do not claim production-grade confidentiality, durability or recovery.** The 2026-10-19 enterprise architecture review rated sensitive-data production readiness 3.5/10 as a *reviewer's assessment*, not a live audit finding. Highest-priority gaps: inspect and version Firebase Security Rules; run cross-user deny tests; verify OAuth domains, project access and deployment configuration; validate restore failure/retry and guest-to-account merge recovery; establish release CI checks and retention/privacy decisions. Browser route guards are UX controls, not authorization.

Known risks include inconsistent branding (LifeHub/DN), large mixed-responsibility components, overlapping CSS, legacy storage migration, potential guest merge failure visibility, absent verified durable offline sync, lack of a canonical transaction ownership policy, and absent original-file attachment storage. Do not infer that roadmap designs (IndexedDB, full-text search, global timeline, notifications or sync outbox) are shipped.

## 6. Engineering and documentation operating rules
1. **Branch discipline:** all requested implementation/documentation work targets `OldVersion` explicitly. The open PR #6 targets `main`; do not merge it or change `main` without instruction. No deployment without separate permission.
2. Prefer small domain-scoped edits, existing JavaScript/JSX patterns, services/stores, and existing CSS tokens. Add targeted tests for behavior changes. Validate domain referential integrity, errors, date handling and guest/account separation.
3. For migration or data format changes, specify schema/version, idempotency, backups, compatibility, rollback, error handling and source-of-truth ownership.
4. Never embed private credentials. Confirm live Firebase Rules rather than extrapolating from client services.
5. Run `npm test` and `npm run build` when an executable workspace is available. Report what was actually run; do not turn planned/manual validation into a pass.
6. Document *why*, user impact, invariants and edge cases; avoid obvious syntax narration. Update this master and the AI-ready extract for substantive verified changes. Keep change history and traceability in this document.
7. Use labels: **Implemented (source-inspected)**, **Verified (test/runtime)**, **Proposed**, **Unknown** and **Deprecated**.

## 7. Architecture decisions and conflicts resolved
| Decision | Canonical resolution | Evidence and reasoning |
|---|---|---|
| LifeHub vs DN | LifeHub describes current runtime; DN is project/possible future brand | Source/docs acknowledge mixed manifest branding; rename requires product approval |
| Cloud-first vs local-first | **Current:** Firebase-backed authenticated records, guest localStorage, shell offline cache. **Target:** undecided | Actual client services prevail over proposed IndexedDB/local-first diagrams |
| Backup v2 vs v3 | **Current:** v3; **Legacy:** v1/v2 normalization where supported | `src/services/backupService.js` constant takes priority over older migration prose |
| Event vs Moment vs eventGroup | Moment/Event = UI/domain; event group = current storage aggregate | Preserves both user meaning and actual persistence |
| Restore overwrite | Merge missing IDs; skip existing conflicts, partial failure possible | Current service and 2026-10-19 backup review; not full destructive restore |
| Security readiness | Not production-verified | Missing in-repo Security Rules/runtime validation outweigh optimistic prose |
| Deep architecture reviews | Historical evidence and proposed targets, not separate normative standards | Long-form reviews contain recommendations not implemented capabilities |

## 8. Open decisions, information gaps and verification queue
| ID | Question or required proof | Owner | Priority |
|---|---|---|---|
| G-01 | Read and reconcile three substantive DOCX sources and identify requirements unique to them | Product/engineering | P0 documentation completeness |
| G-02 | Confirm canonical product brand (DN or LifeHub) and terminology in app/manifest | Product owner | P1 |
| G-03 | Obtain deployed Firestore Rules and perform emulator plus cross-account authorization tests | Security/engineering | P0 |
| G-04 | Choose cloud-first or local-first target; define offline and sync promises | Product/architecture | P0 architecture |
| G-05 | Run build, unit tests, browser/mobile checks and real guest/authenticated backup/restore recovery drills | QA/engineering | P0 |
| G-06 | Define canonical ownership and reconciliation rules for nested vs standalone expenses | Product/engineering | P0 |
| G-07 | Verify guest merge failure UX and retry procedure | Engineering | P1 |
| G-08 | Define original-file storage, backup expectations and retention/privacy model | Product/security | P1 |
| G-09 | Decide authoritative hosting environment, approvals and deployment protections | Operations | P1 |
| G-10 | Confirm retention/deletion of detailed historic audit reports once binary documents are reviewed | Product owner | P2 |

## 9. Source-to-section traceability
| Major section | Primary source(s) |
|---|---|
| Authority and governance | `memory.md`, `rules.md`, `docs/DOCUMENTATION_STANDARDS.md` |
| Product and features | `README.md`, `BUSINESS_GUIDE.md`, `prd.md`, `docs/ARCHITECTURE.md` |
| Architecture and data | `architecture.md`, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE_REVIEW.md`, `src/App.jsx`, `src/main.jsx` |
| UX and branding | `design.md`, `src/design-system.css`, `public/manifest.webmanifest` |
| Code lists | `docs/CODE_LIST_PERSISTENCE.md`, `src/services/codeListService.js` |
| Backup/restore | `docs/BACKUP_RESTORE_REVIEW.md`, `src/services/backupService.js` |
| Risks/roadmap | `docs/ARCHITECTURE_REVIEW.md`, `tasks.md`, `memory.md` |
| Standards/workflow | `rules.md`, `docs/DOCUMENTATION_STANDARDS.md`, `tasks.md` |

## 10. Change history and governance
| Version | Date | Change | Validation |
|---|---|---|---|
| 1.0.0 | 2026-10-21 | Consolidated markdown authority, resolved v3 backup/architecture/naming conflicts, added source matrix and gaps | GitHub source/document inspection; **DOCX, runtime and live Firebase not verified** |

**Change protocol:** Any feature affecting product behavior, persistence, architecture, security or documentation policy must update this master (version, affected sections, evidence paths, decision owner and verification state), update [AI extract](AI_READY_KNOWLEDGE_BASE.md), and record deprecation in [report](DUPLICATE_OBSOLETE_REPORT.md). Historic sources must not silently overrule this master. Version major for incompatible policy/schema/terminology, minor for substantive approved behavior, patch for corrections. Review after material changes and before releases.

## 11. Companion deliverables
- [Duplicate & obsolete document report](DUPLICATE_OBSOLETE_REPORT.md)
- [Merge and consolidation summary](CONSOLIDATION_SUMMARY.md)
- [Retention/deletion matrix](RETENTION_DELETION_MATRIX.md)
- [AI-ready knowledge base](AI_READY_KNOWLEDGE_BASE.md)
