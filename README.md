# DN

Development branch: `OldVersion` in `Divin-kumar/DN_APP_MAIN`.

- [DN business guide](docs/DN_BUSINESS_GUIDE.md) — plain-language app overview, current features, limits and future improvement checklist.
- [Master source of truth](docs/MASTER_SOURCE_OF_TRUTH.md) — current behavior, architecture, data and limits.
- [Agent rules](AGENTS.md) — authorization, development and documentation workflow.
- [Change log](docs/CHANGE_AUDIT_LOG.md) — latest changes first; verification and release history.

## Run locally

Use Node.js 20.19+ (or supported Node 22/24) and npm. App smoke CI uses Node 20; Firebase preview and production workflows use Node 22. Install locked dependencies when authorized:

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

`npm run deploy:hosting` is the legacy manual authenticated release command: it increments package/lock patch versions, builds and publishes Hosting. The opt-in GitHub **production** workflow targets the permanent `dn-10` Firebase Hosting site only when an `OldVersion` push commit title/message contains `[deploy-live]`, or when authorized manually through `workflow_dispatch`. It runs unit, lint and Chromium tests and a production build before uploading. Publication requires an appropriately scoped GitHub Actions repository secret named `FIREBASE_SERVICE_ACCOUNT` (service account JSON for `expense-tracker-divin`); the job fails before upload if it is absent. Never commit or paste the private credential. After upload it checks live index bytes against the exact build. For previews, use the existing `[deploy-preview]` workflow, which never publishes the permanent site. Firebase configuration and hosting details are in the [master](docs/MASTER_SOURCE_OF_TRUTH.md#architecture-overview).

Browser regressions use synthetic records and do not require signing in or writing to Firebase:

```sh
npx playwright install chromium
npm run test:e2e
```

Set the optional DN_TEST_PORT environment variable to use an isolated browser-test port (default 4175). Test output and the browser test server’s separate dependency cache go to ignored `.verification/`. For isolated runtimes, add `--host 127.0.0.1` when starting Vite. Published **1.0.34** provides short, friendly filter choices, single-row phone filters, Moment/Transaction sort controls, 1–3× Activity cover zoom and separate per-Moment-type Dashboard controls for Moments and Activities. The final 65-file production build and seven SPA routes were verified live. See the [change log](docs/CHANGE_AUDIT_LOG.md) for release evidence.

Filters show named choices from the active account/Guest without exposing record IDs or stored metadata. Sort and cover choice/position/zoom remain scoped browser preferences; original files are unchanged. All new originals stay in scoped browser IndexedDB; contextual transactions and Moment Activity cards remain read-only. Transaction creation uses universal +; see the master for routes, source precedence and scope rules. No business-record migration or backup-format update is required. Moment type Dashboard choices use the existing Code List settings.
