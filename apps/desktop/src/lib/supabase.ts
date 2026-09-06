import { createClient } from '@supabase/supabase-js';

import type { PriorityLists } from '../../../../packages/domain/src';

import type { ConnectionState, RoomTransport } from '../stores/room-store';

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
};

export type SupabaseListAdapter = RoomTransport & {
  updateOwnLists(roomId: string, participantToken: string, lists: PriorityLists): Promise<PriorityLists>;
  subscribeToPartnerLists(
    roomId: string,
    participantToken: string,
    onChange: (lists: PriorityLists) => void,
    onConnectionChange?: (state: ConnectionState) => void,
  ): () => void;
};

export function createSupabaseListAdapter(options: SupabaseListAdapterOptions): SupabaseListAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  const backoffMs = options.backoffMs ?? [250, 500, 1_000, 2_000, 5_000];
  const endpoint = `${options.functionsUrl.replace(/\/$/, '')}/list-update`;

  const request = async (body: Record<string, unknown>): Promise<PriorityLists> => {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        apikey: options.anonKey,
        authorization: `Bearer ${options.anonKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json();
    if (!response.ok) throw new Error(readError(payload));
    if (!isListsResponse(payload)) throw new Error('invalid_list_response');
    return copyLists(payload.lists);
  };

  const updateOwnLists = (roomId: string, participantToken: string, lists: PriorityLists) =>
    request({ action: 'update', roomId, participantToken, lists });

  const subscribeToPartnerLists: SupabaseListAdapter['subscribeToPartnerLists'] = (
    roomId,
    participantToken,
    onChange,
    onConnectionChange = () => undefined,
  ) => {
    let channel: RealtimeChannelLike | null = null;
    let stopped = false;
    let retryIndex = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let generation = 0;

    const removeCurrentChannel = () => {
      if (!channel) return;
      const current = channel;
      channel = null;
      void options.realtime.removeChannel(current);
    };

    const refresh = async (currentGeneration: number) => {
      try {
        const lists = await request({ action: 'get_partner', roomId, participantToken });
        if (!stopped && generation === currentGeneration) onChange(lists);
      } catch {
        if (!stopped && generation === currentGeneration) handleFailure(currentGeneration);
      }
    };

    const handleFailure = (currentGeneration: number) => {
      if (stopped || generation !== currentGeneration || retryTimer) return;
      removeCurrentChannel();
      if (retryIndex >= backoffMs.length) {
        onConnectionChange('offline');
        return;
      }
      onConnectionChange('reconnecting');
      const delay = backoffMs[retryIndex++];
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (stopped) return;
      generation += 1;
      const currentGeneration = generation;
      channel = options.realtime
        .channel(`room:${roomId}`)
        .on('broadcast', { event: 'list_changed' }, () => void refresh(currentGeneration))
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

    connect();
    return () => {
      stopped = true;
      generation += 1;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      removeCurrentChannel();
    };
  };

  return {
    updateOwnLists,
    subscribeToPartnerLists,
    update: updateOwnLists,
    subscribe: subscribeToPartnerLists,
  };
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
