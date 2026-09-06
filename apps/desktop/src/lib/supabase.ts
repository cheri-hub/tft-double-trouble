import { createClient } from '@supabase/supabase-js';

import type { PriorityLists } from '../../../../packages/domain/src';

import type { ConnectionState, PartnerPresence, RoomTransport } from '../stores/room-store';

export interface RealtimeChannelLike {
  on(type: 'broadcast', filter: { event: string }, callback: () => void): this;
  subscribe(callback: (status: string) => void): this;
}

export interface RealtimeClientLike {
  channel(topic: string): RealtimeChannelLike;
  removeChannel(channel: RealtimeChannelLike): Promise<unknown> | unknown;
}

export type SupabaseListAdapterOptions = {
  functionsUrl: string;
  anonKey: string;
  realtime: RealtimeClientLike;
  fetchImpl?: typeof fetch;
  backoffMs?: readonly number[];
  heartbeatMs?: number;
  random?: () => number;
  eventTarget?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
};

export type SupabaseListAdapter = RoomTransport & {
  updateOwnLists(roomId: string, participantToken: string, lists: PriorityLists): Promise<PriorityLists>;
  subscribeToPartnerLists(
    roomId: string,
    participantToken: string,
    onChange: (lists: PriorityLists) => void,
    onConnectionChange?: (state: ConnectionState) => void,
    onPartnerPresenceChange?: (state: PartnerPresence) => void,
  ): () => void;
};

export function createSupabaseListAdapter(options: SupabaseListAdapterOptions): SupabaseListAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  const backoffMs = options.backoffMs ?? [250, 500, 1_000, 2_000, 5_000];
  const heartbeatMs = options.heartbeatMs ?? 20_000;
  const random = options.random ?? Math.random;
  const eventTarget = options.eventTarget ?? (typeof window === 'undefined' ? undefined : window);
  const endpointBase = options.functionsUrl.replace(/\/$/, '');

  const post = async (path: string, body: Record<string, unknown>, keepalive = false): Promise<unknown> => {
    const response = await fetchImpl(`${endpointBase}/${path}`, {
      method: 'POST',
      headers: {
        apikey: options.anonKey,
        authorization: `Bearer ${options.anonKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      keepalive,
    });
    const payload: unknown = await response.json();
    if (!response.ok) throw new Error(readError(payload));
    return payload;
  };

  const requestLists = async (body: Record<string, unknown>): Promise<PriorityLists> => {
    const payload = await post('list-update', body);
    if (!isListsResponse(payload)) throw new Error('invalid_list_response');
    return copyLists(payload.lists);
  };

  const requestPartner = async (roomId: string, participantToken: string): Promise<PartnerSnapshot> => {
    const payload = await post('list-update', { action: 'get_partner', roomId, participantToken });
    if (!isPartnerSnapshot(payload)) throw new Error('invalid_partner_response');
    return { lists: copyLists(payload.lists), partnerPresence: payload.partnerPresence };
  };

  const updateOwnLists = (roomId: string, participantToken: string, lists: PriorityLists) =>
    requestLists({ action: 'update', roomId, participantToken, lists });

  const subscribeToPartnerLists: SupabaseListAdapter['subscribeToPartnerLists'] = (
    roomId,
    participantToken,
    onChange,
    onConnectionChange = () => undefined,
    onPartnerPresenceChange = () => undefined,
  ) => {
    let channel: RealtimeChannelLike | null = null;
    let stopped = false;
    let retryIndex = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let generation = 0;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let offline = false;

    const removeCurrentChannel = () => {
      if (!channel) return;
      const current = channel;
      channel = null;
      void options.realtime.removeChannel(current);
    };

    const refresh = async (currentGeneration: number) => {
      try {
        const snapshot = await requestPartner(roomId, participantToken);
        if (!stopped && generation === currentGeneration) {
          onChange(snapshot.lists);
          onPartnerPresenceChange(snapshot.partnerPresence);
        }
      } catch {
        if (!stopped && generation === currentGeneration) handleFailure(currentGeneration);
      }
    };

    const handleFailure = (currentGeneration: number) => {
      if (stopped || generation !== currentGeneration || retryTimer) return;
      removeCurrentChannel();
      onConnectionChange('reconnecting');
      const backoffIndex = Math.min(retryIndex, Math.max(0, backoffMs.length - 1));
      const baseDelay = backoffMs[backoffIndex] ?? 5_000;
      retryIndex += 1;
      const delay = Math.max(0, Math.round(baseDelay * (0.8 + random() * 0.4)));
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (!offline) connect();
      }, delay);
    };

    const connect = () => {
      if (stopped) return;
      generation += 1;
      const currentGeneration = generation;
      channel = options.realtime
        .channel(`room:${roomId}`)
        .on('broadcast', { event: 'list_changed' }, () => void refresh(currentGeneration))
        .on('broadcast', { event: 'presence_changed' }, () => void refresh(currentGeneration))
        .subscribe((status) => {
          if (stopped || generation !== currentGeneration) return;
          if (status === 'SUBSCRIBED') {
            retryIndex = 0;
            onConnectionChange('connected');
            void refresh(currentGeneration);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            handleFailure(currentGeneration);
          }
        });
    };

    const heartbeat = async (refreshAfter = true) => {
      const currentGeneration = generation;
      await post('room-heartbeat', { roomId, participantToken });
      if (refreshAfter && !stopped && currentGeneration === generation) await refresh(currentGeneration);
    };

    const onOnline = () => {
      if (stopped) return;
      offline = false;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      removeCurrentChannel();
      onConnectionChange('reconnecting');
      connect();
      void heartbeat().catch(() => handleFailure(generation));
    };

    const onOffline = () => {
      offline = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      removeCurrentChannel();
      onConnectionChange('offline');
    };

    connect();
    eventTarget?.addEventListener('online', onOnline);
    eventTarget?.addEventListener('offline', onOffline);
    void heartbeat(false).catch(() => handleFailure(generation));
    heartbeatTimer = setInterval(() => void heartbeat().catch(() => handleFailure(generation)), heartbeatMs);
    return () => {
      stopped = true;
      generation += 1;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      eventTarget?.removeEventListener('online', onOnline);
      eventTarget?.removeEventListener('offline', onOffline);
      removeCurrentChannel();
      void post('room-leave', { roomId, participantToken }, true).catch(() => undefined);
    };
  };

  return {
    updateOwnLists,
    subscribeToPartnerLists,
    update: updateOwnLists,
    subscribe: subscribeToPartnerLists,
  };
}

type PartnerSnapshot = { lists: PriorityLists; partnerPresence: PartnerPresence };

function isPartnerSnapshot(value: unknown): value is PartnerSnapshot {
  return isListsResponse(value)
    && 'partnerPresence' in value
    && (value.partnerPresence === 'waiting' || value.partnerPresence === 'online' || value.partnerPresence === 'offline');
}

export type SupabaseRoomClient = {
  functionsUrl: string;
  anonKey: string;
  realtime: RealtimeClientLike;
};

export function createSupabaseRoomClient(url: string, anonKey: string): SupabaseRoomClient {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 2 } },
  });

  return {
    functionsUrl: `${url.replace(/\/$/, '')}/functions/v1`,
    anonKey,
    realtime: {
      channel(topic: string) {
        return client.channel(topic) as RealtimeChannelLike;
      },
      removeChannel(channel: RealtimeChannelLike) {
        return client.removeChannel(channel as never);
      },
    },
  };
}

function isListsResponse(value: unknown): value is { lists: PriorityLists } {
  if (!value || typeof value !== 'object' || !('lists' in value)) return false;
  const lists = value.lists;
  return Boolean(
    lists && typeof lists === 'object' && 'champions' in lists && Array.isArray(lists.champions)
      && 'components' in lists && Array.isArray(lists.components)
      && lists.champions.every((id) => typeof id === 'string')
      && lists.components.every((id) => typeof id === 'string'),
  );
}

function readError(value: unknown): string {
  return value && typeof value === 'object' && 'error' in value && typeof value.error === 'string'
    ? value.error
    : 'list_request_failed';
}

function copyLists(lists: PriorityLists): PriorityLists {
  return { champions: [...lists.champions], components: [...lists.components] };
}
