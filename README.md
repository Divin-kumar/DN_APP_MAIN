# DN

**Active development branch:** [`OldVersion`](https://github.com/Divin-kumar/DN_APP_MAIN/tree/OldVersion) · **Frontend:** React 18 + Vite 5 · **Firebase:** Auth/Firestore · **State:** Zustand.

DN is a personal life-planning and finance web app for moments/events, activities, memories, income, expenses, dashboards, insights and settings. It supports Google sign-in and browser-local guest sessions. Production security and complete backup recovery are **not validated** by this README.

## Documentation on `OldVersion`: exactly four Markdown files

| File | Role |
|---|---|
| [`README.md`](README.md) | This short orientation and developer quick start |
| [`AGENTS.md`](AGENTS.md) | **Mandatory for AI/coding agents editing `OldVersion`**: branch-scoped change control and documentation requirements |
| [`docs/MASTER_SOURCE_OF_TRUTH.md`](docs/MASTER_SOURCE_OF_TRUTH.md) | **Single authoritative app/product/architecture document**, with current state and future backlog |
| [`docs/CHANGE_AUDIT_LOG.md`](docs/CHANGE_AUDIT_LOG.md) | **Append-only** record for every app, code, config, test and governance change |

**Rule on `OldVersion` only:** No change on this branch is complete unless `docs/MASTER_SOURCE_OF_TRUTH.md` is updated and a dated entry is appended to `docs/CHANGE_AUDIT_LOG.md` as part of the **same change/PR**. Future plans belong in the master; do not create another PRD, task list, memory file or architecture Markdown. See `AGENTS.md` for required fields and review gates. A GitHub Actions workflow checks for these documentation changes **only for pushes to `OldVersion` and pull requests targeting `OldVersion`**. Other branches are not subject to these rules.

## Developer commands

```bash
npm install
npm run dev       # Vite dev server, usually port 5173
npm test          # Node test runner
npm run build     # Production dist/ bundle
npm run preview   # Preview build, usually port 4173
```

`npm run deploy:hosting` exists but **requires explicit deployment approval**. `firebase.json` is configured for Firebase Hosting; deployed access rules and environment details must be checked separately.

## Repo navigation

- `src/App.jsx` and `src/main.jsx` — routing and bootstrap.
- `src/pages/`, `src/features/`, `src/components/` — UI screens, features and reusable elements.
- `src/store/` — Zustand state and mutations.
- `src/services/` — account/guest persistence and backup/migration behavior.
- `src/firebase/`, `src/context/`, `src/routes/` — Firebase config, session, route guards.
- `vite.config.js`, `firebase.json`, `public/` — build/PWA/hosting.

Read the **master** for data contracts, architecture, operational caveats, security uncertainties, and planned changes. Historical docs that were removed from the working tree remain accessible in Git history.
