# Double Trouble TFT MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows 10/11 Tauri + React overlay that lets two players share up to ten unique, prioritized champions and components in an ephemeral UUID room.

**Architecture:** A Tauri desktop shell hosts a React/TypeScript UI. A small server package exposes room creation/join, presence, list validation, realtime updates, and 15-minute expiry through Supabase Postgres, Realtime, and Edge Functions. The desktop client owns only the local participant token and its confirmed list; the server is the source of truth.

**Tech Stack:** Tauri 2, Rust, React, TypeScript, Vite, Zustand, `@dnd-kit`, Vitest, Playwright, Supabase Postgres/Realtime/Edge Functions, GitHub Actions, Windows installer.

**Spec:** `docs/superpowers/specs/2026-09-06-double-trouble-tft-design.md`

## Global Constraints

- Windows 10/11 is the only supported desktop platform for the MVP.
- The overlay is intended for TFT in borderless-window mode; exclusive fullscreen is not guaranteed.
- A room accepts at most two active participants and expires 15 minutes after both are offline.
- Each participant has at most ten unique champions and ten unique components, stored in explicit priority order.
- There are no accounts, personal data, history, chat, notifications, automatic game-client integration, or macOS/Linux targets.
- A participant edits only their own lists; a confirmed change is published to the partner in realtime.
- Tests must cover room rules, validation, reconnect, UI flows, and Windows overlay behavior before release.

## File Map

- `apps/desktop/src/`: React screens, overlay UI, client stores, catalog data, and API adapters.
- `apps/desktop/src-tauri/`: native window behavior, global shortcuts, and packaging configuration.
- `packages/domain/src/`: shared TypeScript types and pure validation functions.
- `packages/server/src/`: room lifecycle, participant tokens, list mutation, and expiry logic.
- `supabase/migrations/`: database schema, RLS policies, and cleanup support.
- `supabase/functions/`: authenticated room and list operations.
- `tests/e2e/`: two-client browser-level synchronization scenarios.
- `.github/workflows/`: CI for unit, integration, build, and Windows packaging checks.

---

### Task 1: Scaffold the workspace and executable shells

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/vite.config.ts`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/src/main.tsx`
- Create: `apps/desktop/src/App.tsx`
- Create: `apps/desktop/src/styles.css`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/src/main.rs`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Test: `apps/desktop/src/App.test.tsx`

**Interfaces:**
- Produces a runnable `pnpm --filter desktop dev` app and a Tauri `pnpm --filter desktop tauri dev` shell.
- Exposes a React root with a stable `#app` element and a placeholder `data-testid="app-root"` for later screens.

- [ ] **Step 1: Write the failing smoke test**

```tsx
it('renders the Double Trouble TFT root', () => {
  render(<App />);
  expect(screen.getByTestId('app-root')).toHaveTextContent('Double Trouble TFT');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter desktop vitest run src/App.test.tsx`
Expected: FAIL because the workspace and `App` do not exist.

- [ ] **Step 3: Create the minimal workspace and app shell**

Configure React, Vite, Vitest, Tauri, and the workspace scripts. Render only the title and a neutral loading state; do not add feature UI in this task.

- [ ] **Step 4: Run the test and development build**

Run: `pnpm install; pnpm --filter desktop vitest run src/App.test.tsx; pnpm --filter desktop build`
Expected: PASS, followed by a successful Vite production build.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json apps/desktop
git commit -m "chore: scaffold desktop workspace"
```

### Task 2: Define the shared domain model and pure validation

**Files:**
- Create: `packages/domain/package.json`
- Create: `packages/domain/src/types.ts`
- Create: `packages/domain/src/catalog.ts`
- Create: `packages/domain/src/validation.ts`
- Create: `packages/domain/src/index.ts`
- Test: `packages/domain/src/validation.test.ts`
- Test: `packages/domain/src/catalog.test.ts`

**Interfaces:**
- `type Category = 'champion' | 'component'`.
- `type CatalogEntry = { id: string; name: string; category: Category; icon: string }`.
- `type PriorityLists = { champions: string[]; components: string[] }`.
- `validatePriorityList(ids: string[], catalog: readonly CatalogEntry[]): { ok: true; value: string[] } | { ok: false; code: 'too_many' | 'duplicate' | 'unknown' | 'wrong_category'; index?: number }`.
- `validatePriorityLists(lists: PriorityLists, catalog: readonly CatalogEntry[]): ValidationResult`.
- `CATALOG` contains the initial current-set champion and component entries; list entries are unique by stable `id`, not display name.

- [ ] **Step 1: Write failing validation tests**

```ts
it('accepts ten unique entries in priority order', () => {
  expect(validatePriorityList(ids.slice(0, 10), CATALOG)).toEqual({ ok: true, value: ids.slice(0, 10) });
});

it('rejects an eleventh entry and duplicates', () => {
  expect(validatePriorityList(ids.slice(0, 11), CATALOG)).toMatchObject({ ok: false, code: 'too_many' });
  expect(validatePriorityList([ids[0], ids[0]], CATALOG)).toMatchObject({ ok: false, code: 'duplicate' });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter domain vitest run src/validation.test.ts`
Expected: FAIL because the domain package and validators are absent.

- [ ] **Step 3: Implement the types, catalog, and validators**

Make validation pure and deterministic. Validate category membership separately for champion and component lists. Return the input order unchanged on success so priority is never inferred from names.

- [ ] **Step 4: Run all domain tests**

Run: `pnpm --filter domain vitest run`
Expected: PASS, including unknown ids, wrong-category ids, empty lists, ten-entry lists, duplicates, and eleven-entry lists.

- [ ] **Step 5: Commit**

```bash
git add packages/domain
git commit -m "feat: add shared catalog and priority validation"
```

### Task 3: Implement the room persistence and lifecycle service

**Files:**
- Create: `supabase/migrations/001_rooms.sql`
- Create: `supabase/migrations/002_room_rls.sql`
- Create: `packages/server/package.json`
- Create: `packages/server/src/clock.ts`
- Create: `packages/server/src/room-service.ts`
- Create: `packages/server/src/room-service.test.ts`
- Create: `packages/server/src/participant-token.ts`
- Create: `supabase/functions/room-create/index.ts`
- Create: `supabase/functions/room-join/index.ts`
- Create: `supabase/functions/room-leave/index.ts`
- Create: `supabase/functions/room-heartbeat/index.ts`
- Create: `supabase/functions/room-cleanup/index.ts`

**Interfaces:**
- `createRoom(now: Date): Promise<{ roomId: string; participantToken: string }>`.
- `joinRoom(roomId: string, now: Date): Promise<{ roomId: string; participantToken: string }>`; rejects missing, expired, and full rooms.
- `leaveRoom(roomId: string, participantToken: string, now: Date): Promise<void>`.
- `heartbeat(roomId: string, participantToken: string, now: Date): Promise<void>`.
- `cleanupExpiredRooms(now: Date): Promise<number>`.
- `rooms` stores `id`, `created_at`, `last_both_offline_at`, and `expires_at`; `participants` stores a hashed token, slot, `last_seen_at`, and `online`.

- [ ] **Step 1: Write failing service tests with an injected clock**

```ts
it('creates one room with one participant', async () => {
  const result = await service.createRoom(at('2026-09-06T12:00:00Z'));
  expect(result.roomId).toMatch(/^[0-9a-f-]{36}$/);
  expect(await service.countParticipants(result.roomId)).toBe(1);
});

it('expires a room fifteen minutes after both participants are offline', async () => {
  const room = await service.createRoom(at('2026-09-06T12:00:00Z'));
  await service.joinRoom(room.roomId, at('2026-09-06T12:01:00Z'));
  await service.markBothOffline(room.roomId, at('2026-09-06T12:02:00Z'));
  expect(await service.cleanupExpiredRooms(at('2026-09-06T12:16:59Z'))).toBe(0);
  expect(await service.cleanupExpiredRooms(at('2026-09-06T12:17:00Z'))).toBe(1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter server vitest run src/room-service.test.ts`
Expected: FAIL because the service and schema do not exist.

- [ ] **Step 3: Add the schema, RLS, token handling, and service implementation**

Generate random participant tokens, store only a hash, enforce two participant rows with a unique slot constraint, and set `expires_at = last_both_offline_at + interval '15 minutes'`. Use a scheduled Edge Function for cleanup; rejoining before expiry clears `last_both_offline_at`.

- [ ] **Step 4: Run service tests and local Supabase checks**

Run: `pnpm --filter server vitest run; supabase db reset --local`
Expected: PASS and a successful migration reset with no RLS errors.

- [ ] **Step 5: Commit**

```bash
git add packages/server supabase
git commit -m "feat: add ephemeral two-player room service"
```

### Task 4: Add realtime list operations and client synchronization

**Files:**
- Create: `packages/server/src/list-service.ts`
- Test: `packages/server/src/list-service.test.ts`
- Create: `supabase/functions/list-update/index.ts`
- Create: `apps/desktop/src/lib/supabase.ts`
- Create: `apps/desktop/src/stores/room-store.ts`
- Create: `apps/desktop/src/stores/room-store.test.ts`

**Interfaces:**
- `updateOwnLists(roomId: string, participantToken: string, lists: PriorityLists, now: Date): Promise<PriorityLists>`.
- `subscribeToPartnerLists(roomId: string, participantToken: string, onChange: (lists: PriorityLists) => void): () => void`.
- `useRoomStore` state includes `connection: 'connecting' | 'connected' | 'reconnecting' | 'offline'`, `ownLists`, `partnerLists`, `roomId`, and actions `setOwnLists`, `connect`, `disconnect`.

- [ ] **Step 1: Write failing list and store tests**

```ts
it('persists only the participant own list and returns the validated order', async () => {
  const lists = { champions: ['ahri'], components: ['bf-sword'] };
  await service.updateOwnLists(roomId, tokenA, lists, now);
  expect(await service.getListsForPartner(roomId, tokenB)).toEqual(lists);
});

it('retains the last confirmed list when an update fails', async () => {
  const store = makeRoomStore({ update: async () => { throw new Error('offline'); } });
  store.getState().setOwnLists({ champions: ['ahri'], components: [] });
  await expect(store.getState().saveOwnLists()).rejects.toThrow('offline');
  expect(store.getState().ownLists).toEqual({ champions: [], components: [] });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter server vitest run src/list-service.test.ts; pnpm --filter desktop vitest run src/stores/room-store.test.ts`
Expected: FAIL because the list service and store do not exist.

- [ ] **Step 3: Implement server mutation and Realtime adapter**

Validate with the shared package before writing. Publish an update only after persistence succeeds. Subscribe to the partner projection, retry channel connection with bounded backoff, and re-fetch confirmed state after reconnect.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter server vitest run src/list-service.test.ts; pnpm --filter desktop vitest run src/stores/room-store.test.ts`
Expected: PASS for validation, partner visibility, reconnect state, and failed-write rollback.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src apps/desktop/src/lib apps/desktop/src/stores supabase/functions/list-update
git commit -m "feat: synchronize partner priority lists"
```

### Task 5: Build room entry and connection screens

**Files:**
- Create: `apps/desktop/src/features/room/RoomEntry.tsx`
- Create: `apps/desktop/src/features/room/RoomEntry.test.tsx`
- Create: `apps/desktop/src/features/room/RoomCode.tsx`
- Create: `apps/desktop/src/features/room/room-api.ts`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/styles.css`

**Interfaces:**
- `createRoom(): Promise<{ roomId: string; participantToken: string }>`.
- `joinRoom(roomId: string): Promise<{ roomId: string; participantToken: string }>`.
- `RoomEntry` calls `onConnected(room: ConnectedRoom)` only after the server response is valid.

- [ ] **Step 1: Write failing component tests**

```tsx
it('offers create and join actions', () => {
  render(<RoomEntry onConnected={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Criar sala' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Entrar com UUID' })).toBeInTheDocument();
});

it('shows a copyable UUID after creating a room', async () => {
  api.createRoom.mockResolvedValue({ roomId: 'room-uuid', participantToken: 'token' });
  render(<RoomEntry onConnected={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
  expect(await screen.findByText('room-uuid')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Copiar UUID' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter desktop vitest run src/features/room/RoomEntry.test.tsx`
Expected: FAIL because the entry screen is not implemented.

- [ ] **Step 3: Implement the entry flow and explicit error states**

Keep the UUID input disabled while joining, show translated errors for invalid/expired/full rooms, and persist the participant token only in memory for this process. On success, initialize the room store and transition to the overlay.

- [ ] **Step 4: Run component tests and build**

Run: `pnpm --filter desktop vitest run src/features/room/RoomEntry.test.tsx; pnpm --filter desktop build`
Expected: PASS and successful build.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/features/room apps/desktop/src/App.tsx apps/desktop/src/styles.css
git commit -m "feat: add room creation and join screens"
```

### Task 6: Build the compact and expanded overlay UI

**Files:**
- Create: `apps/desktop/src/features/overlay/CompactOverlay.tsx`
- Create: `apps/desktop/src/features/overlay/ExpandedOverlay.tsx`
- Create: `apps/desktop/src/features/overlay/PriorityList.tsx`
- Create: `apps/desktop/src/features/overlay/CatalogPicker.tsx`
- Create: `apps/desktop/src/features/overlay/Overlay.test.tsx`
- Modify: `apps/desktop/src/styles.css`

**Interfaces:**
- `PriorityList({ title, ids, catalog, editable, onRemove, onReorder })` renders positions 1–10 and keeps the supplied order.
- `CatalogPicker({ category, selectedIds, onAdd })` filters by name and emits only an unselected catalog id.
- `CompactOverlay({ partnerLists, connection, onExpand })` has no local mutation controls.
- `ExpandedOverlay({ ownLists, catalog, onSave, onCollapse })` edits local lists only.

- [ ] **Step 1: Write failing UI tests**

```tsx
it('shows partner lists in priority order and never exposes edit controls', () => {
  render(<CompactOverlay partnerLists={{ champions: ['ahri'], components: ['bf-sword'] }} connection="connected" onExpand={vi.fn()} />);
  expect(screen.getByText('1. Ahri')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /remover/i })).not.toBeInTheDocument();
});

it('adds, removes, and reorders only local entries', async () => {
  const onSave = vi.fn();
  render(<ExpandedOverlay ownLists={{ champions: [], components: [] }} catalog={CATALOG} onSave={onSave} onCollapse={vi.fn()} />);
  await userEvent.type(screen.getByRole('combobox', { name: 'Buscar campeão' }), 'Ahri');
  await userEvent.click(screen.getByRole('option', { name: 'Ahri' }));
  expect(onSave).toHaveBeenCalledWith({ champions: ['ahri'], components: [] });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter desktop vitest run src/features/overlay/Overlay.test.tsx`
Expected: FAIL because the overlay components are absent.

- [ ] **Step 3: Implement compact display, expanded editing, and drag-and-drop**

Use `@dnd-kit/sortable` for keyboard- and pointer-accessible reordering. Keep the compact panel read-only except for expand. Disable add controls after ten entries and disable already selected catalog entries. Display connection and empty-list states without altering data.

- [ ] **Step 4: Run overlay tests and accessibility checks**

Run: `pnpm --filter desktop vitest run src/features/overlay/Overlay.test.tsx; pnpm --filter desktop build`
Expected: PASS and no TypeScript/build errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/features/overlay apps/desktop/src/styles.css
git commit -m "feat: add prioritized partner overlay"
```

### Task 7: Integrate native overlay behavior and persistence

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src/lib/window-settings.ts`
- Create: `apps/desktop/src/lib/window-settings.test.ts`
- Modify: `apps/desktop/src/App.tsx`

**Interfaces:**
- `loadWindowSettings(): WindowSettings` and `saveWindowSettings(settings: WindowSettings): Promise<void>` where `WindowSettings` contains `{ x: number; y: number; width: number; height: number; expanded: boolean }`.
- Tauri commands `get_window_settings` and `save_window_settings` use the app config directory, never the room service, and never store the participant token.

- [ ] **Step 1: Write failing settings tests**

```ts
it('falls back to a safe compact position when settings are missing', async () => {
  expect(await loadWindowSettings()).toEqual({ x: 24, y: 24, width: 320, height: 420, expanded: false });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter desktop vitest run src/lib/window-settings.test.ts`
Expected: FAIL because settings persistence is not implemented.

- [ ] **Step 3: Implement native window configuration**

Set undecorated, transparent, always-on-top, resizable, and minimum size properties in Tauri. Restore bounds on startup, save on move/resize, and toggle between compact and expanded sizes without opening a second window. Keep the UUID/entry screen in a normal centered window until a room is connected.

- [ ] **Step 4: Run desktop tests and a local Tauri build**

Run: `pnpm --filter desktop vitest run; pnpm --filter desktop tauri build --debug`
Expected: PASS and a generated Windows debug bundle on a Windows host.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri apps/desktop/src/lib/window-settings.ts apps/desktop/src/App.tsx
git commit -m "feat: add persistent always-on-top overlay window"
```

### Task 8: Add end-to-end two-client coverage and release checks

**Files:**
- Create: `tests/e2e/room-sync.spec.ts`
- Create: `playwright.config.ts`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/windows-release.yml`
- Modify: `README.md`

**Interfaces:**
- E2E helpers create two isolated clients with separate participant tokens and a controllable fake clock for expiry.
- CI runs domain/server tests on Linux and the Tauri build plus smoke test on Windows.

- [ ] **Step 1: Write the failing two-client scenario**

```ts
test('partner sees an ordered list and room expires after both disconnect', async ({ browser }) => {
  const playerA = await newClient(browser);
  const roomId = await playerA.createRoom();
  const playerB = await newClient(browser);
  await playerB.joinRoom(roomId);
  await playerA.addChampion('Ahri');
  await expect(playerB.partnerList('champions')).toContainText('1. Ahri');
  await playerA.close();
  await playerB.close();
  await advanceServerClock(15 * 60 * 1000);
  await expect(roomExists(roomId)).resolves.toBe(false);
});
```

- [ ] **Step 2: Run the scenario to verify it fails**

Run: `pnpm exec playwright test tests/e2e/room-sync.spec.ts`
Expected: FAIL because the app flow and test harness are not wired together.

- [ ] **Step 3: Implement the test harness, CI, packaging, and operator documentation**

Document local Supabase startup, environment variables, catalog updates, Windows borderless-window requirement, and the release command. Configure CI to fail on unit, integration, accessibility, or build failures and upload the Windows installer as an artifact.

- [ ] **Step 4: Run the complete verification suite**

Run: `pnpm test; pnpm exec playwright test; pnpm --filter desktop tauri build`
Expected: all tests pass and the Windows installer is produced.

- [ ] **Step 5: Commit**

```bash
git add tests playwright.config.ts .github README.md
git commit -m "test: verify two-client sync and Windows release"
```

## Self-review checklist

- Room creation, UUID join, two-player limit, and 15-minute expiry are covered by Task 3 and Task 8.
- Manual unique lists, ten-entry limits, explicit ordering, and partner-only display are covered by Tasks 2, 4, and 6.
- Realtime changes, reconnect, and failed-write rollback are covered by Task 4.
- Overlay window behavior and borderless-window limitation are covered by Task 7 and Task 8.
- Tests and release verification are covered by every task's red/green cycle plus Task 8.
- No unresolved placeholders or unspecified function names remain in the plan.
