# LifeHub architecture and repository review

## 1. Application overview

LifeHub is a personal life-management application that combines life planning, memory tracking, and personal finance in one workspace. The business goal is not just record keeping; it is to help people keep important life events connected to the tasks, memories, and spending that belong with them.

### Business purpose

The application gives users a simple place to:

- track birthdays, anniversaries, festivals, and personal milestones
- link tasks and follow-ups to each event
- hold notes, memories, and files in one place
- track monthly income and spending
- keep important categories and defaults under personal control

### Target users

- individuals managing personal life and finances
- family members tracking celebrations and schedule commitments
- people who prefer an app-like personal dashboard instead of separate tools
- users wanting a guest mode before they fully sign in

## 2. Architecture overview

### Frontend architecture

The frontend is a React Vite application with a single-page layout and nested route structure. It includes:

- a shared application shell
- page-level features for events, financials, settings, and dashboard
- reusable UI building blocks such as modals, dropdowns, and date controls
- route-level lazy loading for better frontend organization

### State management

State is split between global and feature-scoped stores:

- `useAppStore`: core auth state, preferences, theme, defaults, and global notifications
- `useEventStore`: event creation, retrieval, updates, and deletion
- `useExpenseStore`: expense list and financial sync logic
- `useIncomeStore`: income tracking and persistence

This keeps the system understandable: shared concerns live centrally, while operational data stays near the domain it belongs to.

### Firebase usage

Firebase is used for authenticated data persistence. The app creates a standard client configuration with:

- Auth for Google sign-in
- Firestore for user-owned records
- optional Analytics support in production

The data model uses `users/{uid}/eventGroups`, `users/{uid}/expenses`, and `users/{uid}/incomes`. This supports user isolation and a clear ownership model for each record.

### Routing model

The app uses `react-router-dom` to move between screens without full-page reloads. Login is public, while most main app routes are protected behind `ProtectedRoute`. Event workspaces are nested under the main route so each life moment can have its own detail view and related activities.

### Data flow

The main flow is simple:

1. User interacts with a page or form
2. A Zustand store updates the view model
3. A service reads or writes the data source
4. Firestore or browser storage is updated
5. The screen re-renders from the latest store state

### PWA implementation

The app includes an installable web manifest and production service-worker registration. It supports a standalone home-screen experience and can prompt users when a new build is available. The app will refresh selected UI states to keep the version current without forcing users to close and reopen the app manually.

## 3. Functional modules

### Dashboard

Purpose: a summary view for the user’s most important life and money information.

User value: helps the user see what matters now without digging through multiple screens.

Key workflows:

- view upcoming moments
- review quick summaries
- inspect status-related insights and greeting ideas
- move into event or financial detail pages

Dependencies:

- event and activity data
- settings and code lists
- greeting templates and visibility rules

### Moments / Events

Purpose: the core life-planning screen where meaningful events are created and managed.

User value: keeps track of important people, dates, plans, budgets, and memories in one place.

Key workflows:

- create a new life moment
- search, filter, and sort moments
- open event detail workspace
- attach activities, memories, attachments, and expenses
- cancel or restore events as needed

Dependencies:

- event store
- expense store
- code lists for type definitions
- date and status helpers

### Activities

Purpose: personal follow-up tasks associated with an event.

User value: translates intentions into manageable action items.

Key workflows:

- add tasks to events
- assign priorities
- attach costs and due dates
- keep event planning organized

Dependencies:

- event data structure
- financial expense records
- moment-specific categories and reminders

### Memories

Purpose: store context, feelings, and meaningful notes behind a moment.

User value: keeps the story and emotional value of the event alongside its practical details.

Key workflows:

- save notes
- attach photo or file references
- maintain event history and personal context

Dependencies:

- event workspace
- attachments and notes data
- event storage layer

### Expenses

Purpose: track spending and link costs to events or activity categories.

User value: gives users a clearer view of where money is going and how it relates to personal milestones.

Key workflows:

- create and update purchase records
- view recent expense summaries
- attach costs to events, activities, or date periods
- review balance and financial overview

Dependencies:

- expense store
- income store
- event records for nested event spend

### Settings

Purpose: maintain personalization and data governance for the app.

User value: expands the app to fit user habits rather than forcing one rigid default model.

Key workflows:

- manage event types, income types, expense categories
- change reminder time and notification defaults
- reset preferences
- export and import backup data
- control theme and personal defaults

Dependencies:

- `useAppStore`
- code list utilities
- localStorage backup mechanics

### Code Lists

Purpose: defines the reusable option sets the app uses across screens.

User value: lets a user decide what labels matter in the app without changing the code.

Key workflows:

- add new birthday or family categories
- personalize income or spending labels
- define active versus inactive values
- keep saved definitions consistent with app usage

Dependencies:

- `DEFAULT_CODE_LISTS`
- `collectReferencedCodeListValues`
- settings and dynamic filters

### Notifications and alerting

Purpose: support reminders and updates through stored preferences.

User value: reduces missed milestones and helps align recurring actions with personal routines.

Key workflows:

- reminder time selection
- event reminders and summary preferences
- toast messages for success and update notices

Dependencies:

- app preferences
- service worker update prompts
- UI notification system

### Greeting Cards

Purpose: generate celebratory message content based on event type and date.

User value: makes personal occasions feel more polished and thoughtfully handled.

Key workflows:

- generate birthday or anniversary wording
- use event templates and moment types
- present personalized content on the dashboard or summary screen

Dependencies:

- code list metadata
- dashboard visibility logic
- event type definitions

### Reports and insights

Purpose: transform stored personal and financial data into understandable summaries.

User value: gives users a clearer picture of habits, recurring events, and their financial picture.

Dependencies:

- event, income, and expense stores
- dashboard visibility filters
- summary and aggregation logic

## 4. Data model documentation

### Event / Moment

Purpose: represents a meaningful life event or milestone.

Relationships:

- one event can have many activities
- one event can have many memories
- one event can have many attachments
- one event can have multiple associated expenses

Important fields:

- name
- date
- type or customType
- recurrence
- budget
- notes
- greetingCard
- activities
- memories
- attachments
- status

Lifecycle:

- created by a user
- edited over time
- can be restored, cancelled, or deleted
- saved locally or to Firestore depending on session

### Activity

Purpose: a task linked to an event or milestone.

Important fields:

- title
- date
- description
- priority
- completed flag
- expenses

### Memory

Purpose: preserves the emotional and narrative content behind an event.

Important fields:

- note text
- URLs or attachments
- event connection

### Expense

Purpose: captures outgoing financial data.

Important fields:

- name
- amount
- category
- date
- eventId
- activityId
- source

### Income

Purpose: captures incoming financial data.

Important fields:

- name
- type
- amount
- date

### Moment Type

Purpose: a reusable category for life events.

Important fields:

- value
- label
- active / inactive state
- greeting template metadata
- dashboard visibility flag

### Settings and preferences

Purpose: persist personal choices such as default categories and reminder configuration.

Key data points:

- theme
- currency
- dashboard view
- default event type
- notifications
- list sorting

## 5. Firebase documentation

### Collections and ownership

The app stores user data under a unique user ID. That means each person has a private set of records and guest data can be merged into an account later.

### Reads and writes

Reads and writes happen through service modules such as:

- eventService
- expenseService
- incomeService
- guestMergeService

These modules read Firestore documents and apply normalization before the UI consumes them.

### Security assumptions

This repository relies on Firebase security rules outside the app code. The client assumes the user has access only to their own data and that rules protect all user-owned collections.

### Guest mode

Guest users store demo or temporary records in `localStorage`. When a user signs in later, the app merges those local records into the authenticated account to reduce data loss and create a smoother transition.

## 6. PWA documentation

### Service worker

The app registers a service worker in production to support offline shell behavior and version updates.

### Offline behavior

The app remains usable as a shell even when the network is intermittent. The user can continue using the app as long as the core assets are already available.

### Cache strategy

The app uses a versioned service-worker registration so new deployment versions can trigger a user-visible update prompt instead of silently serving stale content.

### Install prompts and home-screen behavior

The manifest allows the app to install as a standalone app on supported devices. This creates a more native feel and improves daily usage.

## 7. Technical debt review

### Critical

- Some files contain dense logic and are difficult for a non-developer to follow without narrative context.
- The app relies on localStorage heavily for user settings and guest data, so data consistency needs careful maintenance.
- Some sample-data and guest-mode flows are blended into the same domain logic, increasing complexity.

### High

- The dashboard and event workspace contain a large amount of business logic in one place.
- Several screens combine state, persistence, UI behavior, and business rules in a way that can be difficult to maintain.
- The app has multiple patterns for handling storage and persistence, which increases cognitive load.

### Medium

- Some module responsibilities are broad and could be split into clearer domain modules.
- Notification and reminder logic is spread across store preferences and UI logic.
- Some app-specific terms such as “eventGroups” and “adminValues” are still implementation-driven rather than business-driven.

### Low

- A few screens are clearly documented, but documentation is still uneven across the repo.
- Some code comments are useful but could be improved with more business-language explanations.

## 8. Documentation coverage report

### Coverage status

- Dashboard: good coverage in code comments and screens
- Events: good coverage in module comments and page structure
- Settings: good coverage in application flow and settings logic
- Firebase: moderate coverage, with more business explanation needed
- PWA: moderate coverage, but service-worker update logic can be clearer for non-developers
- Code lists: good coverage in utilities but still technical
- Business guide: newly added to make the app understandable for non-technical readers

### Remaining undocumented areas

- deeper sample-data scenarios and demoing logic
- full description of all greeting-card generation rules
- more explicit explanation of timeline and recurrence calculations
- edge-case handling for event cancellation/restoration and nested expense reconciliation

## 9. Summary

LifeHub is a life-management and small-finance app designed for regular people, not only developers. The architecture is understandable once it is framed as “one place for personal events, tasks, memory, and money.” The repository is functional and organized, but its documentation needs to speak more in business language so future maintainers and non-technical stakeholders can understand the purpose behind the code.
