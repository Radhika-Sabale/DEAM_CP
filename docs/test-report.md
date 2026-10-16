# Test Report

Generated unit-test totals are stored in [test-summary.json](test-summary.json). Regenerate them after a fresh Vitest JSON run with `npm run docs:report`.

## Current results

- Unit and integration tests: 1,455 passed across 203 test files.
- Typecheck, lint, and production build: passed.
- Playwright E2E: not run successfully in this environment. Playwright Chromium could not be downloaded from its CDN, so there are no current E2E pass counts.

The unit suite includes engine tests, module tests, integration flows, and a 500-gate circuit performance case. Tests under `src/engine/` were not changed in this redesign.

## Reproduce

```sh
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright install chromium
npm run e2e
```
