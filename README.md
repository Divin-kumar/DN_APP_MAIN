# DN

Development branch: `OldVersion` in `Divin-kumar/DN_APP_MAIN`.

- [DN business guide](docs/DN_BUSINESS_GUIDE.md) — plain-language app overview, current features, limits and future improvement checklist.
- [Master source of truth](docs/MASTER_SOURCE_OF_TRUTH.md) — current behavior, architecture, data and limits.
- [Agent rules](AGENTS.md) — authorization, development and documentation workflow.
- [Change log](docs/CHANGE_AUDIT_LOG.md) — latest changes first; verification and release history.

## Run locally

Use Node.js 20.19+ (or supported Node 22/24) and npm. Smoke-test CI uses Node 20; the opt-in preview workflow uses Node 22. Install locked dependencies when authorized:

```sh
npm ci
npm run dev
npm run lint
npm test
npm run check:docs
npm run build
npm run preview
```

Dev uses port 5173; preview uses 4173 and requires a successful build. Both bind `0.0.0.0`.

`npm run deploy:hosting` increments package/lock patch versions, builds and publishes Hosting. It requires deployment authorization and is not a build check. Firebase configuration and hosting details are in the [master](docs/MASTER_SOURCE_OF_TRUTH.md#architecture-overview).

Browser regressions use synthetic records and do not require signing in or writing to Firebase:

```sh
npx playwright install chromium
npm run test:e2e
```

Test output and the browser test server’s separate dependency cache go to ignored `.verification/`. For isolated runtimes, add `--host 127.0.0.1` when starting Vite. Source 1.0.28 adds nested Activity Detail and Moment Transactions; see the master for routes, source precedence and scope rules. No migration or backup-format update is required.
