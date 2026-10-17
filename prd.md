# Product Requirements Document — LifeHub

> **Scope:** This document describes the implementation found on the `OldVersion` branch of `DN_APP_MAIN`. Code is the authority for implemented behavior; items described as intended or requiring verification are not guarantees.

## 1. Product overview

LifeHub is a responsive, installable React web application for personal life planning and lightweight personal finance. It brings meaningful events and milestones together with follow-up activities, notes/memories, attachments, income and expense records, configurable categories, and dashboard insights. It supports Google-authenticated accounts backed by Firebase and a browser-local guest mode.

The repository has evolved from an expense-tracking application into a broader life-and-finance workspace. Some branding remains mixed (LifeHub in source/docs and DN in the PWA manifest/service-worker messages); keep this in mind when changing product copy.

## 2. Goals and non-goals

### Product goals
- Help users remember birthdays, anniversaries, festivals, travel, and personal milestones.
- Keep planning actions and memories associated with the event they belong to.
- Track income, expenses, and a high-level financial picture.
- Let users customize categories, defaults, theme, sorting, and dashboard preferences.
- Provide a mobile-friendly, installable PWA experience with a useful offline application shell.
- Let prospective users explore guest mode and later merge guest records into an authenticated account.

### Explicit non-goals evidenced by the current code
- This is not a multi-user shared family workspace; records are scoped to a single authenticated Firebase UID.
- It is not a banking integration or automated transaction importer.
- It is not a server-rendered application or a separately deployed API service.
- Full offline synchronization of Firestore data is not established by the service-worker shell alone.

## 3. Target audience and personas

| Persona | Needs | Relevant modules |
|---|---|---|
| Personal organizer | Remember meaningful dates and organize plans | Dashboard, Events, Activities, Memories |
| Household/personal finance tracker | Record income and spending, review totals | Financials, Income, Expenses, Insights |
| Customization-oriented user | Tailor categories, defaults, theme, and sorting | Settings, Code Lists |
| Cautious first-time user | Explore without immediately creating an account | Guest mode, Login |
| Mobile-first user | Open the app from a home-screen icon and use it in a compact viewport | PWA shell, responsive layouts |

## 4. Product modules and requirements

### 4.1 Authentication and guest mode
- Provide Google sign-in through Firebase Authentication.
- Provide a guest mode whose session choice is persisted in localStorage.
- Restore guest mode after refresh when the guest-mode key remains enabled.
- Listen to Firebase auth state and expose a consistent session state to the app.
- When a user authenticates, attempt to merge locally stored guest records into the account before finalizing the app-level user state.
- Protect authenticated application routes while allowing login/public entry routes.
- On merge failure, log the error and still complete the user session transition; the UI must not imply that a failed merge succeeded.

### 4.2 Dashboard
- Present an overview of relevant events, activities, and financial summaries.
- Offer navigation/quick actions into the underlying modules.
- Use dashboard visibility preferences and helper utilities to determine which cards/sections are shown.
- Support greeting-card/message suggestions derived from event types and templates.
- Handle loading and empty data without breaking the main shell.

### 4.3 Events / life moments
- Create, read, update, and delete personal events/moments.
- Store event name, date, type/custom type, recurrence, budget, notes, greeting-card data, memories, attachments, activities, status, and creation timestamp where present.
- Support event searching, filtering, sorting, summary/detail workspace navigation, and event status calculation.
- Support recurring event concepts and cancellation/restoration flows where exposed by the UI.
- Normalize missing or malformed optional fields at the service boundary.
- Associate activities, memories, attachments, and event-related expenses with the relevant event.

### 4.4 Activities
- Maintain follow-up actions inside an event workspace.
- Capture title, date, description, priority, completion/cancellation state, completion timestamp, and nested expense entries where present.
- Default priority to `medium` and date to the current local ISO date fallback used by the service.
- Keep activity identifiers stable when updating existing records.
- Ensure activity-linked expenses are not double-counted when merged with master expense records.

### 4.5 Memories and attachments
- Keep notes/memories and attachment references connected to an event.
- Preserve these fields through event normalization and persistence.
- The repository model includes arrays for memories and attachments; validate actual file upload/storage behavior before promising cloud file storage, size limits, or supported MIME types.

### 4.6 Expenses
- Record an expense with name, numeric amount, category, description, date, creation timestamp, optional event/activity links, and source.
- Support create, list, update, and delete flows.
- Use Firestore for authenticated records and localStorage for guest records.
- Include nested expenses stored under event activities in financial reporting, merging duplicate representations by stable record identifiers.
- Preserve optimistic UI updates and restore prior UI state if authenticated persistence fails.
- Default category to `Other`, amount to a numeric value, and date to the service fallback.

### 4.7 Income and financial overview
- Record income name, type, numeric amount, date, and creation timestamp.
- Support authenticated Firestore persistence and guest-local persistence.
- Present income/expense/balance summaries through Financials, Income, Expenses, and Insights screens.
- Do not infer currency conversion or bank-account connectivity; no such integration is established by the inspected code.

### 4.8 Settings and code lists
- Persist preferences such as theme, notification settings, default event/income/expense types, list sort preferences, and dashboard choices where implemented.
- Manage configurable event types, income types, expense categories, and related option metadata through Code Lists.
- Support active/inactive values and schema-versioned migration of stored code lists.
- When resetting lists, preserve values referenced by existing records where helper logic specifies that behavior.
- Offer export/import or reset actions only to the extent implemented by the current Settings UI; verify actual backup coverage before relying on it operationally.

### 4.9 Insights, reports, and greetings
- Derive summaries from the event, income, and expense datasets.
- Use greeting templates/preferences and event type metadata to produce celebration-oriented copy.
- Keep aggregation logic deterministic and avoid counting nested activity expenses twice.

### 4.10 PWA and update lifecycle
- Provide a web app manifest with standalone display, portrait-primary orientation, app icon, and theme/background colors.
- Generate a production service worker through the Vite build plugin.
- Pre-cache the app shell and entry assets; use a network-first navigation fallback to cached HTML and cache-first behavior for eligible assets.
- Prompt an existing installation when a newer service-worker version is waiting, and activate it only after the user chooses Refresh.
- Treat this as shell-level offline support, not proof that remote Firestore reads/writes work offline.

## 5. Key user journeys

### First visit / guest
1. User opens the root URL.
2. App initializes theme, React Router, global stores, and auth listener.
3. User chooses guest mode from the entry experience.
4. Guest choice is stored in localStorage.
5. User creates or edits events, activities, expenses, or income.
6. Guest data remains in browser storage and is loaded by the relevant service/store.

### Google sign-in
1. User opens the login flow.
2. Firebase Authentication performs Google sign-in.
3. Auth listener receives the signed-in user.
4. Guest-to-account merge is attempted.
5. App state is updated with UID and available profile fields.
6. Protected routes load the account-scoped data from Firestore.

### Create or edit an event
1. Open Events and start the event form.
2. Enter event fields and optional related information.
3. Form passes event data to the event store.
4. Store normalizes IDs/defaults/status and applies an optimistic UI update for authenticated data.
5. Service writes to `users/{uid}/eventGroups`, or to guest localStorage in guest mode.
6. On persistence failure, store restores the previous UI state and exposes an error.

### Add an activity and related cost
1. Open an event workspace.
2. Add or update an activity with its title/date/priority/completion details.
3. Optionally attach expense records to the activity.
4. Save the event containing its activity data.
5. Expense service combines top-level expense records with nested activity expenses for reporting, de-duplicating by record key.

### Record an income or expense
1. Open the relevant financial module.
2. Enter amount, label/category/type, date, and optional event association.
3. Store normalizes numeric/date values.
4. Guest data is written locally; authenticated data is written to the user-scoped Firestore collection.
5. Financial overview and insights render from updated stores.

### Update the PWA
1. A production deployment publishes a new app version.
2. Browser discovers and installs the new service worker.
3. If an existing controller is active and the waiting version matches the current app version, show an update toast.
4. User selects Refresh.
5. Worker receives `SKIP_WAITING`, activates, claims clients, and the page reloads on controller change.

## 6. Non-functional requirements

### Performance
- Keep initial bundles reasonable; Firebase Analytics is dynamically imported and only initialized in production.
- Use route-level lazy loading where already configured.
- Avoid duplicate concurrent loads for the same user/session key; feature stores use pending-load maps.
- Keep UI responsive with optimistic updates for authenticated create/update/delete flows.

### Security and privacy
- Scope authenticated records beneath the Firebase UID.
- Enforce authorization in Firebase Security Rules; client-side route protection is not a security boundary.
- Never commit service-account credentials or private secrets.
- Firebase client configuration is public-client configuration, but Firestore rules and allowed authentication domains must be reviewed before production use.
- Guest data is browser-local and may be lost if browser storage is cleared.

### Reliability and data integrity
- Normalize records at service boundaries.
- De-duplicate expense representations by stable IDs.
- Roll back optimistic state when writes fail.
- Avoid claiming full offline data synchronization without a verified Firestore persistence strategy.
- Handle malformed localStorage JSON without crashing startup.

### Accessibility and usability
- Maintain visible keyboard focus and semantic labels.
- Use touch-friendly controls and readable contrast in both themes.
- Test common flows on narrow mobile viewports and desktop.
- Verify dialogs, dropdowns, forms, and navigation with keyboard and screen-reader semantics.

### Compatibility and operations
- Build with the pinned package lock.
- Validate production builds and PWA update behavior after changes to entry assets or worker generation.
- Keep Firebase Hosting SPA rewrites and no-cache headers for entry/worker files intact unless intentionally redesigned.

## 7. Product acceptance criteria

- Guest and authenticated sessions are clearly distinguished.
- CRUD operations work for events, expenses, and income in their applicable storage modes.
- Event activities and nested expenses remain associated after reload.
- Financial reporting does not double-count activity-linked costs.
- Theme and code-list preferences survive reload and migrate safely.
- Direct navigation to nested routes works after Hosting rewrites.
- A production build generates `dist/sw.js`, and an installed PWA can receive a controlled update prompt.
- No documentation claims are made for unverified behavior such as file upload limits, push notifications, full offline writes, or automatic backups.
