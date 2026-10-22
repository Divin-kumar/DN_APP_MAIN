# DN

DN is a personal Moments, activities and finance web app. Development target: `OldVersion` in `Divin-kumar/DN_APP_MAIN`.

## Documentation index

| Document | Purpose |
|---|---|
| [Master source of truth](docs/MASTER_SOURCE_OF_TRUTH.md) | Canonical current behavior, architecture, routes, persistence, configuration and verification limits |
| [Development and documentation rules](AGENTS.md) | Mandatory workflow for every future development task; read before editing |
| [Audit archive](docs/CHANGE_AUDIT_LOG.md) | Preserved historical records only; not current behavior or maintenance policy |
| `README.md` | Setup commands and this index |

Document changed behavior in the master in the same task/change set as code. Replace obsolete descriptions, disclose unverified behavior and update setup/process instructions here or in AGENTS when affected. Keep the existing four Markdown files; do not create duplicate architecture or rules documents.

## Local commands

Use Node.js with npm. Existing CI uses Node 20 for smoke tests and Node 22 for preview deployment; package.json declares no engines constraint. When dependency installation is authorized, use the lockfile:

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Dev defaults to port 5173; preview defaults to 4173. Both bind `0.0.0.0`. Preview needs a successful build. Missing Vite prevents the build and tests importing Vite; do not claim successful validation or install dependencies when the task prohibits it.

Firebase client configuration is embedded in `src/firebase/config.js`, not loaded from `VITE_FIREBASE_*`. See [operations](docs/MASTER_SOURCE_OF_TRUTH.md#13-pwa-environment-and-operations) for build metadata, caching and Hosting. `npm run deploy:hosting` changes package/lock versions and deploys Hosting; it needs explicit authorization and is not a validation command.

## Validation limits

The 2026-10-22 checks for DN 1.0.19 pass all 143 Node tests and the production build. DN 1.0.19 is deployed at [dn-10.web.app](https://dn-10.web.app). Dependency audit reports 9 advisories (3 moderate, 6 high); build warns about a large chunk. Local guest UI journeys and read-only account display have been exercised; cloud business-data writes/restore remain unverified. See [deployment and validation evidence](docs/MASTER_SOURCE_OF_TRUTH.md#15-validation-and-maintenance).

The [changelog](docs/CHANGE_AUDIT_LOG.md) puts the latest change first and preserves older entry text. The governance workflow requires a master update and a new top CHG entry while checking the four-file Markdown inventory. Run `node scripts/check-audit-log.mjs <base-commit-sha>` to verify historical preservation and ordering before pushing. [AGENTS.md](AGENTS.md#automated-enforcement) defines the current rules.
