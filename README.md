# DN

Development branch: `OldVersion` in `Divin-kumar/DN_APP_MAIN`.

Approved changes are committed and pushed to `OldVersion` for owner review through the existing Vercel integration. Firebase publication remains a separately authorized step after that review; see [agent rules](AGENTS.md).

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

Set the optional DN_TEST_PORT environment variable to use an isolated browser-test port (default 4175). Test output and the browser test server’s separate dependency cache go to ignored `.verification/`. For isolated runtimes, add `--host 127.0.0.1` when starting Vite. Published **1.0.35** provides a smaller filter panel that automatically remembers the last active filters, shorter comparison menus, dropdowns that wait for explicit search focus, and a minimal Dashboard greeting with date controls beside each section heading. All 63 served files and seven SPA routes matched the final tested production build. See the [change log](docs/CHANGE_AUDIT_LOG.md) for release evidence.

Filters show named choices from the active account/Guest without exposing record IDs or stored metadata. Each filter stays on one phone row; the panel scrolls within a bounded height. Active filters, sort and cover choice/position/zoom remain scoped browser preferences; original files are unchanged. The Dashboard greeting shows the user’s name and date on all screens, without summary metrics or greeting-triggered finance loads. Activity list cards stay menu-free, show the Moment name clearly as plain text and retain opening-source-aware detail paging. Code Lists now owns both sorting and on-demand filters for the three overall lists; the redundant Settings sorting shortcut is removed. All new originals stay in scoped browser IndexedDB; contextual transactions and Moment Activity cards remain read-only. Transaction creation uses universal +; edit forms provide a choices-first Linked Moment/Activity picker and open search only when requested, with no implicit nested-label focus. Both Dashboard and Moments-page summaries now download actual multi-page PDFs including available photo previews and no displayed photo filenames; PDF pages are image-rendered, not selectable text or a recovery backup. See the master for routes, source precedence and scope rules. No business-record migration or backup-format update is required. Moment type Dashboard choices use the existing Code List settings.
