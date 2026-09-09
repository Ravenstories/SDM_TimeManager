# SDM Time Manager

A lightweight, local-first chess clock for **VD · SDM** and **SIT · SDM / Servicedesk**. Counts up, with exactly one active responsibility. No runtime dependencies or backend.

## Run

Use Node.js 22 or later. Run `npm start` and open http://127.0.0.1:4173. Run `npm test` for domain tests and `npm run build` for the static `dist/` output.

## Use

Click a role to start or switch. Pause for breaks or at the end of the day. While the page has focus, 1 and 2 select roles and Space pauses. Shortcuts are ignored inside controls. Compact view reduces the interface to the clocks. Notes are attached to a role and the current day; the date picker shows previous notes and totals.

The home screen is for daily work. **Reports** provides daily, weekly, monthly, and yearly views, with totals per responsibility, percentage split, tracked days, and a daily breakdown. Weeks begin on Monday. Select a date in a report to open its notes. Report CSV exports all days in the selected calendar period, including zero-activity days, with decimal hours. Running time is included up to the most recent refresh.

Running time continues across minimized windows, browser closure, computer sleep, and midnight until explicitly paused. The app stores a timestamp and reconstructs elapsed time when it opens; it does not execute in the background while the browser is closed. Midnight divides time by local calendar day. Manual system-clock/timezone changes affect wall-clock accounting. Remember to pause when you finish work.

Time and notes stay in an IndexedDB database in this browser and are not sent to GitHub or a server. Existing v1 localStorage records are migrated on first use, inside a transaction, without deleting the original. LocalStorage remains in use for the note draft. Data does not sync between devices, browsers, or origins.

**Data & help** shows browser storage protection status, a button to request persistent storage, backup export status, and recovery points. Up to 14 snapshots are created before the first mutation of each local day and before a restore. A snapshot and its associated mutation commit atomically. Recovery points share the same browser storage as the main records; they are not off-device backups.

Export JSON backups regularly and keep the downloaded files outside this browser. A reminder appears until an export is requested, and again after seven days. The app records a download request; it cannot verify whether you retained that file. Restoring a backup replaces current data after confirmation, saves a recovery point first, and closes any imported active session at the export timestamp. Older v1 JSON backups remain supported. The session CSV exports UTC intervals and minutes; report CSV exports local-day totals and decimal hours.

Browser protection can reduce automatic eviction, but clearing site data, private browsing, or device loss can still remove records. Storage errors are displayed; malformed records are not silently replaced. Private cross-device cloud storage is not configured. A future sync adapter requires authentication and per-user access control; public GitHub files must never serve as private time/note storage.

Use a current browser on HTTPS or localhost. IndexedDB transactions serialize updates across tabs; BroadcastChannel refreshes other open tabs, and visible tabs reload state when brought forward. The app shell is cached for offline use after an online visit. Bump the service-worker cache version when changing shipped assets; an update becomes active after existing app windows close. Close older app tabs when upgrading to the IndexedDB version. Install availability depends on browser support; pinning the tab works independently.

## Architecture

- `src/domain.js`: pure state transitions, validation, local-day aggregation, formatting. No browser dependencies.
- `src/indexed-repository.js`: asynchronous transactional persistence, legacy migration, metadata, and bounded recovery history.
- `src/storage.js`: original v1 adapter and key retained for legacy migration/regression coverage.
- `src/reports.js` and `src/backup.js`: pure calendar reporting and backup transformations.
- `src/report-view.js` and `src/data-view.js`: reporting and storage UI controllers with injected dependencies.
- `src/app.js`: UI coordination; depends on the repository abstraction and domain functions.
- `src/styles.css`: responsive presentation. Semantic buttons, labels, visible keyboard focus, and textual active states.
- `scripts/`: dependency-free development server and static build.

Keep business rules in the domain, browser persistence in its adapter, and UI concerns in the UI. Prefer small functions and explicit dependencies over speculative class hierarchies.

## GitHub Pages

1. Push this folder to your GitHub repository's `main` branch.
2. In repository Settings → Pages → Build and deployment, choose **GitHub Actions**.
3. Run the included Deploy GitHub Pages workflow, or push to `main`.

The workflow tests and builds before deploying only `dist/`. All paths are relative, supporting both repository and root Pages sites. See [GitHub's publishing documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Public repository: https://github.com/Ravenstories/SDM_TimeManager. Pages: https://ravenstories.github.io/SDM_TimeManager/. Pages is configured to deploy through GitHub Actions.

## Concept

See [concept art](docs/concept.png) and [generation brief](docs/concept-prompt.md). The original visual exploration showed countdowns; user feedback selected count-up tracking without budgets. The implementation follows that choice.
