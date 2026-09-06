import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PriorityLists } from '../../../../packages/domain/src';

import * as supabase from '../lib/supabase';
import { createSupabaseListAdapter, type RealtimeChannelLike } from '../lib/supabase';
import { createRoomStore, makeRoomStore, type ConnectionState, type RoomTransport } from './room-store';

const emptyLists: PriorityLists = { champions: [], components: [] };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('room store', () => {
  it('retains an unsaved draft and exposes a retryable error when an update fails', async () => {
    const store = makeRoomStore({ update: async () => { throw new Error('offline'); } });

    store.getState().setOwnLists({ champions: ['ahri'], components: [] });

    await expect(store.getState().saveOwnLists()).rejects.toThrow('offline');
    expect(store.getState().ownLists).toEqual(emptyLists);
    expect(store.getState().draftOwnLists).toEqual({ champions: ['ahri'], components: [] });
    expect(store.getState()).toMatchObject({ saveStatus: 'error', saveError: 'offline' });
  });

  it('serializes rapid saves so an older response cannot overwrite a newer edit', async () => {
    const first = deferred<PriorityLists>();
    const second = deferred<PriorityLists>();
    const update = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const store = makeRoomStore({ update });

    store.getState().connect('room-id', 'participant-token');
    store.getState().setOwnLists({ champions: ['ahri'], components: [] });
    const saving = store.getState().saveOwnLists();
    store.getState().setOwnLists({ champions: ['akali'], components: [] });
    void store.getState().saveOwnLists();

    expect(update).toHaveBeenCalledTimes(1);
    first.resolve({ champions: ['ahri'], components: [] });
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(store.getState().draftOwnLists).toEqual({ champions: ['akali'], components: [] });

    second.resolve({ champions: ['akali'], components: [] });
    await saving;
    expect(store.getState()).toMatchObject({
      ownLists: { champions: ['akali'], components: [] },
      draftOwnLists: { champions: ['akali'], components: [] },
      saveStatus: 'saved',
      saveError: null,
    });
  });

  it('replaces the confirmed list only with the server response', async () => {
    const store = makeRoomStore({
      update: async () => ({ champions: ['ahri'], components: ['bf-sword'] }),
    });
    store.getState().setOwnLists({ champions: ['ahri'], components: [] });

    await store.getState().saveOwnLists();

    expect(store.getState().ownLists).toEqual({ champions: ['ahri'], components: ['bf-sword'] });
  });

  it('tracks connection status and partner projections until disconnect', () => {
    let onLists: ((lists: PriorityLists) => void) | undefined;
    let onConnection: ((state: ConnectionState) => void) | undefined;
    let onPresence: ((state: 'waiting' | 'online' | 'offline') => void) | undefined;
    const unsubscribe = vi.fn();
    const transport: RoomTransport = {
      update: async (_roomId, _token, lists) => lists,
      subscribe: (_roomId, _token, listsChanged, connectionChanged, presenceChanged) => {
        onLists = listsChanged;
        onConnection = connectionChanged;
        onPresence = presenceChanged;
        return unsubscribe;
      },
    };
    const store = makeRoomStore(transport);

    store.getState().connect('room-id', 'participant-token');
    expect(store.getState().connection).toBe('connecting');

    onConnection?.('connected');
    onPresence?.('online');
    onLists?.({ champions: ['ahri'], components: [] });
    expect(store.getState()).toMatchObject({
      roomId: 'room-id',
      connection: 'connected',
      partnerPresence: 'online',
      partnerLists: { champions: ['ahri'], components: [] },
    });

    store.getState().disconnect();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(store.getState()).toMatchObject({ roomId: null, connection: 'offline' });
  });

  it('wires a default transport that can save and receive partner lists end to end', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    const adapterUpdate = vi.fn(async (_roomId: string, _token: string, lists: PriorityLists) => ({
      ...lists,
      champions: [...lists.champions, 'zaun'],
    }));
    const adapterSubscribe = vi.fn((_roomId, _token, onChange, onConnectionChange) => {
      onConnectionChange('connected');
      onChange({ champions: ['partner-champ'], components: [] });
      return vi.fn();
    });
    vi.spyOn(supabase, 'createSupabaseRoomClient').mockReturnValue({
      functionsUrl: 'https://example.test/functions/v1',
      anonKey: 'anon-key',
      realtime: {
        channel: vi.fn(),
        removeChannel: vi.fn(),
      },
    });
    vi.spyOn(supabase, 'createSupabaseListAdapter').mockReturnValue({
      updateOwnLists: adapterUpdate,
      subscribeToPartnerLists: adapterSubscribe,
      update: adapterUpdate,
      subscribe: adapterSubscribe,
    });
    const store = createRoomStore();

    store.getState().connect('room-id', 'participant-token');
    store.getState().setOwnLists({ champions: ['ahri'], components: [] });
    await store.getState().saveOwnLists();

    expect(store.getState().connection).toBe('connected');
    expect(store.getState().partnerLists).toEqual({ champions: ['partner-champ'], components: [] });
    expect(store.getState().ownLists).toEqual({ champions: ['ahri', 'zaun'], components: [] });
    expect(adapterUpdate).toHaveBeenCalledWith(
      'room-id',
      'participant-token',
      { champions: ['ahri'], components: [] },
    );
  });
});

describe('Supabase list adapter', () => {
  afterEach(() => vi.useRealTimers());

  it('reconnects with capped backoff and re-fetches confirmed partner state', async () => {
    vi.useFakeTimers();
    const channels: FakeChannel[] = [];
    const realtime = {
      channel: () => {
        const channel = new FakeChannel();
        channels.push(channel);
        return channel;
      },
      removeChannel: vi.fn(async () => undefined),
    };
    const listResponses = [
      { lists: emptyLists, partnerPresence: 'waiting' },
      { lists: { champions: ['ahri'], components: [] }, partnerPresence: 'online' },
    ];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/list-update')
      ? jsonResponse(listResponses.shift())
      : jsonResponse({ ok: true }));
    const adapter = createSupabaseListAdapter({
      functionsUrl: 'https://example.test/functions/v1',
      anonKey: 'anon-key',
      realtime,
      fetchImpl,
      backoffMs: [100, 200],
      heartbeatMs: 60_000,
      random: () => 0.5,
    });
    const connectionStates: ConnectionState[] = [];
    const changes: PriorityLists[] = [];

    const unsubscribe = adapter.subscribeToPartnerLists(
      'room-id',
      'participant-token',
      (lists) => changes.push(lists),
      (state) => connectionStates.push(state),
    );
    channels[0].emitStatus('SUBSCRIBED');
    await vi.waitFor(() => expect(changes).toHaveLength(1));

    channels[0].emitStatus('CHANNEL_ERROR');
    expect(connectionStates[connectionStates.length - 1]).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(100);
    channels[1].emitStatus('SUBSCRIBED');
    await vi.waitFor(() => expect(changes).toHaveLength(2));

    expect(changes[changes.length - 1]).toEqual({ champions: ['ahri'], components: [] });
    expect(connectionStates[connectionStates.length - 1]).toBe('connected');
    expect(fetchImpl.mock.calls.filter(([url]) => String(url).endsWith('/list-update'))).toHaveLength(2);

    unsubscribe();
    expect(realtime.removeChannel).toHaveBeenCalledTimes(2);
  });

  it('keeps retrying indefinitely at the capped delay and reconnects immediately when online', async () => {
    vi.useFakeTimers();
    const channels: FakeChannel[] = [];
    const realtime = {
      channel: () => {
        const channel = new FakeChannel();
        channels.push(channel);
        return channel;
      },
      removeChannel: async () => undefined,
    };
    const adapter = createSupabaseListAdapter({
      functionsUrl: 'https://example.test/functions/v1',
      anonKey: 'anon-key',
      realtime,
      fetchImpl: vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/list-update')
        ? jsonResponse({ lists: emptyLists, partnerPresence: 'waiting' })
        : jsonResponse({ ok: true })),
      backoffMs: [10, 20],
      heartbeatMs: 60_000,
      random: () => 0.5,
      eventTarget: window,
    });
    const states: ConnectionState[] = [];

    adapter.subscribeToPartnerLists('room-id', 'token', vi.fn(), (state) => states.push(state));
    channels[0].emitStatus('CHANNEL_ERROR');
    await vi.advanceTimersByTimeAsync(10);
    channels[1].emitStatus('TIMED_OUT');
    await vi.advanceTimersByTimeAsync(20);
    channels[2].emitStatus('CHANNEL_ERROR');
    await vi.advanceTimersByTimeAsync(20);

    expect(states[states.length - 1]).toBe('reconnecting');
    expect(channels).toHaveLength(4);

    channels[3].emitStatus('CHANNEL_ERROR');
    window.dispatchEvent(new Event('online'));
    expect(channels).toHaveLength(5);
  });

  it('sends authenticated heartbeats and a best-effort leave while subscribed', async () => {
    vi.useFakeTimers();
    const channel = new FakeChannel();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/list-update')
      ? jsonResponse({ lists: emptyLists, partnerPresence: 'offline' })
      : jsonResponse({ ok: true }));
    const adapter = createSupabaseListAdapter({
      functionsUrl: 'https://example.test/functions/v1',
      anonKey: 'anon-key',
      realtime: { channel: () => channel, removeChannel: async () => undefined },
      fetchImpl,
      heartbeatMs: 1_000,
      eventTarget: window,
    });

    const unsubscribe = adapter.subscribeToPartnerLists('room-id', 'participant-token', vi.fn());
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/functions/v1/room-heartbeat',
      expect.objectContaining({ body: JSON.stringify({ roomId: 'room-id', participantToken: 'participant-token' }) }),
    ));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchImpl.mock.calls.filter(([url]) => String(url).endsWith('/room-heartbeat'))).toHaveLength(2);

    unsubscribe();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/functions/v1/room-leave',
      expect.objectContaining({ keepalive: true }),
    ));
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

class FakeChannel implements RealtimeChannelLike {
  private statusCallback: ((status: string) => void) | undefined;
  private broadcastCallback: (() => void) | undefined;

  on(_type: 'broadcast', _filter: { event: string }, callback: () => void): this {
    this.broadcastCallback = callback;
    return this;
  }

  subscribe(callback: (status: string) => void): this {
    this.statusCallback = callback;
    return this;
  }

  emitStatus(status: string): void {
    this.statusCallback?.(status);
  }

  emitBroadcast(): void {
    this.broadcastCallback?.();
  }
}
