# SDM Time Manager

A lightweight, local-first chess clock for **VD · SDM** and **SIT · SDM / Servicedesk**. Counts up, with exactly one active responsibility. No runtime dependencies or backend.

## Run

Use Node.js 22 or later. Run `npm start` and open http://127.0.0.1:4173. Run `npm test` for domain tests and `npm run build` for the static `dist/` output.

## Use

Click a role to start or switch. Pause for breaks or at the end of the day. While the page has focus, 1 and 2 select roles and Space pauses. Shortcuts are ignored inside controls. Compact view reduces the interface to the clocks. Notes are attached to a role and the current day; the date picker shows previous notes and totals.

Running time continues across minimized windows, browser closure, computer sleep, and midnight until explicitly paused. The app stores a timestamp and reconstructs elapsed time when it opens; it does not execute in the background while the browser is closed. Midnight divides time by local calendar day. Manual system-clock/timezone changes affect wall-clock accounting. Remember to pause when you finish work.

Data stays in this browser's localStorage and is not sent to GitHub or a server. It does not sync between devices, browsers, or site URLs. Export JSON backups through Data & help. Restoring replaces current data after confirmation and closes any imported active session at the export timestamp. CSV exports session intervals with UTC timestamps and duration in minutes. Clearing browser storage deletes records. Storage errors are displayed and existing malformed records are not overwritten automatically.

Current browsers on HTTPS or localhost are required for coordinated writes using Web Locks. Multiple tabs share the same state and serialize updates. The app shell is cached for offline use after an online visit. Bump the service-worker cache version when changing shipped assets; an update becomes active after existing app windows close. Install availability depends on browser support; pinning the tab works independently.

## Architecture

- `src/domain.js`: pure state transitions, validation, local-day aggregation, formatting. No browser dependencies.
- `src/storage.js`: persistence adapter with serialized read-modify-write transactions.
- `src/app.js`: UI coordination; depends on the repository abstraction and domain functions.
- `src/styles.css`: responsive presentation. Semantic buttons, labels, visible keyboard focus, and textual active states.
- `scripts/`: dependency-free development server and static build.

Keep business rules in the domain, browser persistence in its adapter, and UI concerns in the UI. Prefer small functions and explicit dependencies over speculative class hierarchies.

## GitHub Pages

1. Push this folder to your GitHub repository's `main` branch.
2. In repository Settings → Pages → Build and deployment, choose **GitHub Actions**.
3. Run the included Deploy GitHub Pages workflow, or push to `main`.

The workflow tests and builds before deploying only `dist/`. All paths are relative, supporting both repository and root Pages sites. See [GitHub's publishing documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Repository: https://github.com/Ravenstories/SDM_TimeManager. Expected Pages address: https://ravenstories.github.io/SDM_TimeManager/. GitHub Pages must be enabled for the workflow to deploy; availability for private repositories depends on the account plan.

## Concept

See [concept art](docs/concept.png) and [generation brief](docs/concept-prompt.md). The original visual exploration showed countdowns; user feedback selected count-up tracking without budgets. The implementation follows that choice.
