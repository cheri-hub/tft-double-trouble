# Final Fix Report

Date: 2026-09-06

Scope: finalize the existing uncommitted MVP review fixes in `.worktrees/double-trouble-mvp` without resetting prior work.

## Files touched in this final pass

- `.github/workflows/ci.yml`
- `README.md`
- `package.json`
- `scripts/sync-catalog.mjs`
- `scripts/sync-catalog.test.mjs`
- `supabase/functions/_shared/catalog-ids.ts`
- `supabase/functions/deno.lock`
- `supabase/functions/list-update/index.ts`
- `supabase/functions/room-heartbeat/index.ts`
- `supabase/functions/room-leave/index.ts`
- `apps/desktop/src/lib/window-settings.ts`
- `apps/desktop/src/lib/window-settings.test.ts`

## What was finalized

- Pinned the Supabase CLI version in CI to `2.51.0` so the workflow uses a deterministic toolchain instead of `latest`.
- Added a cross-runtime catalog sync path:
  - `pnpm sync:catalog` regenerates `supabase/functions/_shared/catalog-ids.ts` from `packages/domain/src/catalog.ts`.
  - `pnpm test:catalog-sync` verifies the shared edge-function IDs stay in lockstep with the domain catalog.
  - `pnpm test` now includes the catalog sync test before the package test suites.
- Documented the catalog regeneration workflow in `README.md`.
- Updated the desktop window bounds logic to read real monitor work areas via `availableMonitors()`, convert physical pixels to logical pixels, and preserve off-screen positions on secondary monitors when the bounds still intersect a visible display.
- Added focused window bounds tests for:
  - negative coordinates on a secondary monitor;
  - large 4k-sized logical bounds that should remain valid;
  - the `availableMonitors()` path used by overlay mode.
- Hardened the Supabase edge handlers so short-lived broadcast channel cleanup is best effort instead of failing the user-facing mutation.
- Regenerated `supabase/functions/_shared/catalog-ids.ts` from the domain catalog.
- Downgraded `supabase/functions/deno.lock` from lockfile version 5 to 4 so it matches the current Deno 2.x toolchain used in CI and local function tests.

## Verification

### Passed

- `pnpm test:catalog-sync`
- `pnpm --filter desktop vitest run src/lib/window-settings.test.ts`
- `pnpm --filter @double-trouble/domain vitest run src/catalog.test.ts`

### Relevant output

- `pnpm test:catalog-sync`:
  - `ok 1 - edge catalog ids stay in lockstep with the domain catalog`
- `pnpm --filter desktop vitest run src/lib/window-settings.test.ts`:
  - `7 tests passed`
- `pnpm --filter @double-trouble/domain vitest run src/catalog.test.ts`:
  - `4 tests passed`

## Remaining concerns

- I did not boot a local Supabase stack in this pass, so the full runtime contract path still needs environment-backed verification outside these focused tests.
- The repo still contains unrelated pre-existing edits outside this final-fix scope; I left them untouched.

