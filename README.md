# Double Trouble TFT

Double Trouble TFT is a two-player Windows overlay for sharing ordered champion and
component priorities during a Teamfight Tactics Double Up game. A room holds at most
two participants and expires 15 minutes after both disconnect.

The desktop shell is Tauri 2 + React 19. The overlay UI is built on Tailwind v4, Radix
primitives, and vendored [Watermelon UI](https://ui.watermelon.sh) components
(`apps/desktop/src/components/ui`). Real-time state lives in Supabase (Postgres +
Realtime + Edge Functions); rooms hold only transient data and no accounts.

## Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| Node.js | 22 | everything |
| pnpm | 9.15.4 | everything |
| Rust | stable + [Tauri Windows prerequisites](https://tauri.app/start/prerequisites/) | `tauri dev`, `tauri build` |
| Microsoft Edge WebView2 Runtime | current | running the Windows shell |
| Deno | 2.x | Edge Function tests only |
| Supabase CLI + Docker Desktop | CLI 2.x | local backend + integration tests only |

Install JavaScript dependencies from the repository root:

```powershell
pnpm install
```

## Configure

The desktop app reads its Supabase connection from `apps/desktop/.env.local`
(git-ignored). Copy the template and fill it in:

```powershell
copy apps\desktop\.env.example apps\desktop\.env.local
```

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<ANON_KEY>
```

For a local backend, get the values from `supabase status -o env` after starting it
(below). For a hosted project, use its API URL and public anon key. Only the anon key
belongs in a `VITE_` variable — never the service-role key, and never commit either
env file or participant tokens.

## Run

### Local backend (optional — only for end-to-end manual testing)

Start Docker Desktop, then from the repository root:

```powershell
supabase start
supabase db reset --local
supabase functions serve
```

Run `supabase status -o env` in another terminal and put `API_URL` / `ANON_KEY` into
`apps/desktop/.env.local`. The Supabase CLI supplies `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` to the served Edge Functions.

### App

```powershell
pnpm dev                          # web UI at http://localhost:5173 (React flow only)
pnpm --filter desktop tauri dev   # native borderless overlay window
```

Browser dev verifies the React flow but cannot certify native borderless positioning,
DPI behavior, transparency, or always-on-top. Do that on Windows with TFT in
**windowed-borderless** mode (exclusive fullscreen blocks third-party overlays).

## Testing

| Command | What it covers | Docker? |
| --- | --- | --- |
| `pnpm test` | build-env + catalog-sync scripts, domain, server, and desktop component/accessibility tests | no |
| `pnpm typecheck:e2e` | type-checks the Playwright suite | no |
| `pnpm exec playwright test` | two-client sync scenario through the real UI (hermetic — fake clients, tokens, and expiry clock) | no |
| `pnpm check:functions`<br>`deno test --allow-env --allow-net supabase/functions/_shared/list-validation.test.ts supabase/functions/room-join/index.test.ts` | Edge Function validation and `room-join` | no |
| `pnpm test:integration` | Supabase contract against a running local stack | yes |

First-time Playwright setup:

```powershell
pnpm exec playwright install chromium
```

Run this suite locally before opening a pull request — CI only checks that the app
builds, it does not run the tests:

```powershell
pnpm test
pnpm typecheck:e2e
pnpm exec playwright test
```

## Building

Windows 10/11 with WebView2 is the only supported target. Building needs Rust and a
populated `apps/desktop/.env.local` (or `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
in the shell) — the build fails if the produced bundle is missing them.

```powershell
pnpm build                          # web assets only -> apps/desktop/dist
pnpm --filter desktop tauri build   # MSI + NSIS installers
```

`tauri build` runs `pnpm build` first (`tsc -b`, `vite build`, then a check that the
built artifact carries the Supabase config). Installers land in:

```
apps/desktop/src-tauri/target/release/bundle/msi/*.msi
apps/desktop/src-tauri/target/release/bundle/nsis/*.exe
```

## Releasing

Tag a commit on `main` and push the tag:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

`.github/workflows/release.yml` then builds on `windows-latest`, sets the app version
from the tag (`v1.0.0` -> `1.0.0` in `tauri.conf.json` and `Cargo.toml`), and publishes
a GitHub Release named `Double Trouble TFT v1.0.0` with auto-generated notes and both
installers (`.msi` and `.exe`) attached.

`.github/workflows/ci.yml` runs a Windows `tauri build` on every pull request and push
to `main` so a broken build is caught before merge. Neither workflow runs the test
suite — run it locally (see [Testing](#testing)).

Both workflows need the repository secrets `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`.

## Update the TFT catalog

Edit `packages/domain/src/catalog.ts`. Keep stable lowercase IDs, preserve the explicit
display order, and update the snapshot version, source URL, and filtering-rule comment
above `CATALOG`. Catalog IDs are persisted in room lists, so renaming or removing an
existing ID is a data-contract change, not a display-only edit.

Regenerate the shared Edge Function ID list and re-run the affected tests:

```powershell
pnpm sync:catalog
pnpm test:catalog-sync
pnpm --filter @double-trouble/domain vitest run
pnpm --filter desktop vitest run
```

## App icon

The editable source is `apps/desktop/src-tauri/icons/app-icon.svg`. After changing it,
regenerate the checked-in icon set from the repository root:

```powershell
pnpm --filter desktop tauri icon src-tauri/icons/app-icon.svg --output src-tauri/icons
```

Keep the generated files referenced by `bundle.icon` in `tauri.conf.json`; Windows
packaging requires `icon.ico`.
