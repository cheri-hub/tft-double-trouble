# Double Trouble TFT

Double Trouble TFT is a two-player Windows overlay for sharing ordered champion and component priorities. A room holds at most two participants and expires 15 minutes after both participants disconnect.

## Prerequisites

- Node.js 22 and pnpm 9.15.4
- Rust stable and the Tauri Windows prerequisites
- Supabase CLI and Docker Desktop for the local backend
- Microsoft Edge WebView2 Runtime for the Windows desktop shell

Install JavaScript dependencies with `pnpm install`.

## Run the local backend

Start Docker Desktop, then initialize the database from the repository root:

```powershell
supabase start
supabase db reset --local
supabase functions serve
```

In another terminal, run `supabase status -o env`. Create `apps/desktop/.env.local` using the reported API URL and anonymous key:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied to locally served Edge Functions by the Supabase CLI. Do not put the service-role key in a `VITE_` variable or commit either local environment file or participant tokens.

Start the web UI with `pnpm dev`, or the native shell with:

```powershell
pnpm --filter desktop tauri dev
```

## Tests

Run the domain, server, component, and accessibility coverage with `pnpm test`. That suite now includes a catalog contract check that verifies `supabase/functions/_shared/catalog-ids.ts` matches `packages/domain/src/catalog.ts`.

If you edit the catalog, regenerate the shared edge-function IDs first:

```powershell
pnpm sync:catalog
pnpm test:catalog-sync
```

Run the Edge Function integration check with `deno test --allow-env --allow-net supabase/functions/room-join/index.test.ts`.

The browser scenario is hermetic—it provides two isolated clients, separate participant tokens, and a fake expiry clock, so it does not require Docker or a running Supabase instance:

```powershell
pnpm exec playwright install chromium
pnpm typecheck:e2e
pnpm exec playwright test
```

The scenario creates and joins a room through the real UI, updates player A's list, verifies player B receives the ordered partner list, disconnects both clients, and advances the server clock through the 15-minute expiry boundary.

## Update the TFT catalog

Edit `packages/domain/src/catalog.ts`. Keep stable lowercase IDs, preserve the explicit display order, and update the snapshot version, source URL, and filtering-rule comment above `CATALOG`. Then regenerate the edge-function contract and rerun the catalog tests:

```powershell
pnpm sync:catalog
pnpm test:catalog-sync
pnpm --filter @double-trouble/domain vitest run
pnpm --filter desktop vitest run
```

Catalog IDs are persisted in room lists, so renaming or removing an existing ID is a data-contract change rather than a display-only edit. The generator keeps the client and server ID lists in lockstep.

## Windows overlay and release

The supported release target is Windows 10/11 with WebView2. The app starts as a decorated room-entry window, then deliberately switches to a transparent, borderless, always-on-top window after joining a room. Browser development verifies the React flow but cannot certify native borderless positioning, DPI behavior, transparency, or always-on-top behavior; perform that smoke check on Windows before distributing an installer.

Build the release installers on Windows:

```powershell
pnpm test
pnpm exec playwright test
pnpm --filter desktop tauri build
```

Tauri writes MSI and NSIS bundles below `apps/desktop/src-tauri/target/release/bundle/`. The `Windows release` workflow runs the same checks for version tags (`v*`) or manual dispatch and uploads both installer formats as a workflow artifact.

The editable icon source is `apps/desktop/src-tauri/icons/app-icon.svg`. After changing it, regenerate the checked-in Tauri icon set from the repository root with:

```powershell
pnpm --filter desktop tauri icon src-tauri/icons/app-icon.svg --output src-tauri/icons
```

Keep the generated desktop files referenced by `bundle.icon` in `tauri.conf.json`; Windows packaging requires `icon.ico`.
