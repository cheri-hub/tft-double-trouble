import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PriorityLists } from '../../../../packages/domain/src';

import { createSupabaseListAdapter, type RealtimeChannelLike } from '../lib/supabase';
import { makeRoomStore, type ConnectionState, type RoomTransport } from './room-store';

const emptyLists: PriorityLists = { champions: [], components: [] };

describe('room store', () => {
  it('retains the last confirmed list when an update fails', async () => {
    const store = makeRoomStore({ update: async () => { throw new Error('offline'); } });

    store.getState().setOwnLists({ champions: ['ahri'], components: [] });

    await expect(store.getState().saveOwnLists()).rejects.toThrow('offline');
    expect(store.getState().ownLists).toEqual(emptyLists);
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
    const unsubscribe = vi.fn();
    const transport: RoomTransport = {
      update: async (_roomId, _token, lists) => lists,
      subscribe: (_roomId, _token, listsChanged, connectionChanged) => {
        onLists = listsChanged;
        onConnection = connectionChanged;
        return unsubscribe;
      },
    };
    const store = makeRoomStore(transport);

    store.getState().connect('room-id', 'participant-token');
    expect(store.getState().connection).toBe('connecting');

    onConnection?.('connected');
    onLists?.({ champions: ['ahri'], components: [] });
    expect(store.getState()).toMatchObject({
      roomId: 'room-id',
      connection: 'connected',
      partnerLists: { champions: ['ahri'], components: [] },
    });

    store.getState().disconnect();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(store.getState()).toMatchObject({ roomId: null, connection: 'offline' });
  });
});

describe('Supabase list adapter', () => {
  afterEach(() => vi.useRealTimers());

  it('reconnects with bounded backoff and re-fetches confirmed partner state', async () => {
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
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ lists: emptyLists }))
      .mockResolvedValueOnce(jsonResponse({ lists: { champions: ['ahri'], components: [] } }));
    const adapter = createSupabaseListAdapter({
      functionsUrl: 'https://example.test/functions/v1',
      anonKey: 'anon-key',
      realtime,
      fetchImpl,
      backoffMs: [100, 200],
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
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    unsubscribe();
    expect(realtime.removeChannel).toHaveBeenCalledTimes(2);
  });

  it('goes offline after exhausting reconnect attempts', async () => {
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
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ lists: emptyLists })),
      backoffMs: [10, 20],
    });
    const states: ConnectionState[] = [];

    adapter.subscribeToPartnerLists('room-id', 'token', vi.fn(), (state) => states.push(state));
    channels[0].emitStatus('CHANNEL_ERROR');
    await vi.advanceTimersByTimeAsync(10);
    channels[1].emitStatus('TIMED_OUT');
    await vi.advanceTimersByTimeAsync(20);
    channels[2].emitStatus('CHANNEL_ERROR');

    expect(states[states.length - 1]).toBe('offline');
    expect(channels).toHaveLength(3);
  });
});

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
