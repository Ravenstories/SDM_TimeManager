# SDM Time Manager

A lightweight, local-first chess clock for **VD · SDM**, **SIT · SDM / Servicedesk**, and any number of additional responsibilities. Counts up, with exactly one active responsibility. No runtime dependencies or backend.

## Run

Use Node.js 22 or later. Run `npm start` and open http://127.0.0.1:4173. Run `npm test` for domain tests and `npm run build` for the static `dist/` output.

## Use

Click a role to start or switch. Pause for breaks or at the end of the day. Every clock shows both hours:minutes:seconds and decimal hours. **Adjust start time** corrects the running session without stopping it, for example when work began a few minutes before the timer was started. The adjusted start cannot overlap existing tracked time. **Auto-switch** can switch after a duration from now or when the current timer reaches a chosen total for today, including earlier sessions on that timer. For example, a 30-minute total with 10 minutes already tracked switches in 20 minutes. Total-based plans adjust when tracked time is corrected; duration-based plans keep their deadline. A total must be greater than the time already tracked and reachable before midnight. A manual pause or role change cancels it. If the app is closed at the deadline, it applies the handoff at the planned time when it next opens. While the page has focus, keys 1–9 select the first nine visible roles and Space pauses. Shortcuts are ignored inside controls. Compact view reduces the interface to the clocks. Notes are attached to a role and the current day; the date picker shows previous notes and totals. Use **Edit time** to add, correct, or delete completed entries for the selected day. Saved notes can also be edited or deleted. **Data & help** can add any number of named clocks for ad hoc work, meetings, or breaks and optionally exclude each one from the work total. The clock grid adds a new row after every three clocks on larger screens. Removing a clock keeps its history.

The home screen is for daily work. **Reports** provides daily, weekly, monthly, and yearly views, with totals per responsibility, percentage split, tracked days, and a daily breakdown. Weeks begin on Monday. Select a date in a report to open its notes. Report CSV exports all days in the selected calendar period, including zero-activity days, with decimal hours. Running time is included up to the most recent refresh.

Running time continues across minimized windows, browser closure, computer sleep, and midnight until explicitly paused. The app stores a timestamp and reconstructs elapsed time when it opens; it does not execute in the background while the browser is closed. Midnight divides time by local calendar day. Manual system-clock/timezone changes affect wall-clock accounting. Remember to pause when you finish work.

Time and notes stay in an IndexedDB database in this browser and are not sent to GitHub or a server. Existing v1 localStorage records are migrated on first use, inside a transaction, without deleting the original. LocalStorage remains in use for the note draft. Data does not sync between devices, browsers, or origins.

**Data & help** shows browser storage protection status, a button to request persistent storage, backup export status, and recovery points. Up to 14 snapshots are created before the first mutation of each local day and before a restore. A snapshot and its associated mutation commit atomically. Recovery points share the same browser storage as the main records; they are not off-device backups.

Export JSON backups regularly and keep the downloaded files outside this browser. A reminder appears until an export is requested, and again after seven days. The app records a download request; it cannot verify whether you retained that file. Restoring a backup replaces current data after confirmation, saves a recovery point first, and closes any imported active session at the export timestamp. Older v1 JSON backups remain supported. The session CSV exports UTC intervals and minutes; report CSV exports local-day totals and decimal hours.

Browser protection can reduce automatic eviction, but clearing site data, private browsing, or device loss can still remove records. Storage errors are displayed; malformed records are not silently replaced. Private cross-device cloud storage is not configured. A future sync adapter requires authentication and per-user access control; public GitHub files must never serve as private time/note storage.

Use a current browser on HTTPS or localhost. IndexedDB transactions serialize updates across tabs; BroadcastChannel refreshes other open tabs, and visible tabs reload state when brought forward. The app shell is cached for offline use after an online visit. Production builds derive the service-worker version from all shipped files. Updates download a complete fresh shell and activate even with other tabs open. Open pages show **Reload to update**; save any open edits before using it. Timers, saved notes, and the new-note draft survive reload. The app checks for updates on opening, returning to the tab, reconnecting, and every five minutes while visible. Clearing browser cache or site data is not needed. Close older app tabs when upgrading to the IndexedDB version. Install availability depends on browser support; pinning the tab works independently.

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

## Database compatibility

The browser database uses IndexedDB version 3. It accepts the original timer records
and converts responsibility-based version 2 records from the development release.
Conversion preserves session timestamps, notes, custom labels, classification and
archive metadata; archived or unclassified clocks remain unavailable for starting.
The original v2 state is kept in `records/before-v2-compatibility` and a recovery
point, in the same transaction as the converted records. Existing metadata and
recovery points are retained. v2 JSON backups can also be restored.

Run `npm ci` before `npm test`. Storage regression tests use `fake-indexeddb`
(a development dependency only) and cover database versions 1 and 2, new databases,
preservation, reopening, and rejection of malformed records.
