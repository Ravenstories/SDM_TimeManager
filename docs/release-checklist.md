# Release checklist

## Before merging

- Run `npm ci`, `npm test`, `npm run build`, and `npm run test:browser`.
- Review the four milestone commits and the state/backup compatibility changes.
- Verify migration on a copied v1 backup, including missing additional settings.
- Inspect desktop and mobile controls and dialogs. The automated enlarged-layout
  check uses CSS zoom at 200%; this does not substitute for all OS/browser zoom
  and assistive-technology combinations.
- Keep generated test fixtures out of the release artifact. The release tests
  remove their bounded temporary directories from dist after completion.
- Read the migration notice in CHANGELOG.md. Keep the v1 checkpoint; do not
  clear IndexedDB to solve cache or update issues.

## Publication

Merge the reviewed branch into main. The workflow runs the checks, publishes
dist to GitHub Pages and navigates the published application in a fresh Chromium
context. The post-deploy smoke must pass; a successful upload alone is not proof
of a healthy deployed application.

The published smoke is read-only with respect to user records: it has a fresh
isolated browser context. Local test success is not reported as production
deployment evidence.

## After publication

- Confirm that a returning app window offers an update.
- Save/cancel drafts, close other app windows, then apply it.
- Verify the displayed build version and existing record counts.
- Confirm that work/non-work summaries agree with the daily export.
- Keep release notes available with the repository.

## Recovery

Migration and restore create atomic checkpoints. Prefer a forward-compatible
fix if a problem is discovered after migration; older v1 application code cannot
open the v2 database. Restoring a v1 backup through the v2 app is supported and
creates a checkpoint of the current records first.

## Validation limits

Automated browser tests run Chromium in isolated contexts; mobile layout is
emulated. Real iOS Safari, installed-app behavior on every operating system,
screen-reader combinations, device sleep and OS-level 200% zoom remain manual
platform checks. Timestamp reconstruction and DST boundaries are covered by
deterministic tests.
