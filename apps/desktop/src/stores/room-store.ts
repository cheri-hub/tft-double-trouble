import { useSyncExternalStore } from 'react';

import type { PriorityLists } from '../../../../packages/domain/src';
import { createSupabaseListAdapter } from '../lib/supabase';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline';

export interface RoomTransport {
  update(roomId: string, participantToken: string, lists: PriorityLists): Promise<PriorityLists>;
  subscribe?(
    roomId: string,
    participantToken: string,
    onChange: (lists: PriorityLists) => void,
    onConnectionChange: (state: ConnectionState) => void,
  ): () => void;
}

export type RoomStoreState = {
  connection: ConnectionState;
  ownLists: PriorityLists;
  draftOwnLists: PriorityLists;
  partnerLists: PriorityLists;
  roomId: string | null;
  participantToken: string | null;
  setOwnLists(lists: PriorityLists): void;
  saveOwnLists(): Promise<void>;
  connect(roomId: string, participantToken: string): void;
  disconnect(): void;
};

type Listener = () => void;
type Selector<T> = (state: RoomStoreState) => T;

export type RoomStore = {
  (): RoomStoreState;
  <T>(selector: Selector<T>): T;
  getState(): RoomStoreState;
  subscribe(listener: Listener): () => void;
};

export type RoomStoreOptions = {
  transport?: RoomTransport;
};

const emptyLists = (): PriorityLists => ({ champions: [], components: [] });

export function createRoomStore(options: RoomStoreOptions = {}): RoomStore {
  return makeRoomStore(options.transport ?? createLazyDefaultRoomTransport());
}

export function makeRoomStore(transport: RoomTransport): RoomStore {
  const listeners = new Set<Listener>();
  let unsubscribe: (() => void) | null = null;
  let state: RoomStoreState;

  const emit = () => listeners.forEach((listener) => listener());
  const setState = (patch: Partial<RoomStoreState>) => {
    state = { ...state, ...patch };
    emit();
  };

  state = {
    connection: 'offline',
    ownLists: emptyLists(),
    draftOwnLists: emptyLists(),
    partnerLists: emptyLists(),
    roomId: null,
    participantToken: null,
    setOwnLists(lists) {
      setState({ draftOwnLists: copyLists(lists) });
    },
    async saveOwnLists() {
      try {
        const confirmedLists = await transport.update(
          state.roomId ?? '',
          state.participantToken ?? '',
          copyLists(state.draftOwnLists),
        );
        setState({ ownLists: copyLists(confirmedLists), draftOwnLists: copyLists(confirmedLists) });
      } catch (error) {
        setState({ draftOwnLists: copyLists(state.ownLists) });
        throw error;
      }
    },
    connect(roomId, participantToken) {
      unsubscribe?.();
      unsubscribe = null;
      setState({ roomId, participantToken, connection: 'connecting', partnerLists: emptyLists() });
      if (!transport.subscribe) return;
      unsubscribe = transport.subscribe(
        roomId,
        participantToken,
        (lists) => setState({ partnerLists: copyLists(lists) }),
        (connection) => setState({ connection }),
      );
    },
    disconnect() {
      unsubscribe?.();
      unsubscribe = null;
      setState({
        roomId: null,
        participantToken: null,
        connection: 'offline',
        partnerLists: emptyLists(),
      });
    },
  };

  const getState = () => state;
  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const useStore = (<T>(selector: Selector<T> = ((value) => value as unknown as T)) =>
    useSyncExternalStore(subscribe, () => selector(state), () => selector(state))) as RoomStore;
  useStore.getState = getState;
  useStore.subscribe = subscribe;
  return useStore;
}

export const useRoomStore = createRoomStore();

function createLazyDefaultRoomTransport(): RoomTransport {
  let transport: RoomTransport | null = null;
  const resolve = () => {
    if (!transport) transport = createDefaultRoomTransport();
    return transport;
  };
  return {
    update(roomId, participantToken, lists) {
      return resolve().update(roomId, participantToken, lists);
    },
    subscribe(roomId, participantToken, onChange, onConnectionChange) {
      return resolve().subscribe?.(roomId, participantToken, onChange, onConnectionChange) ?? (() => undefined);
    },
  };
}

function createDefaultRoomTransport(): RoomTransport {
  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!functionsUrl || !anonKey) {
    throw new Error('room_transport_not_configured');
  }

  const supabase = (globalThis as { supabase?: { channel(topic: string): unknown; removeChannel(channel: unknown): unknown } }).supabase;
  if (!supabase) throw new Error('room_transport_not_configured');

  return createSupabaseListAdapter({
    functionsUrl,
    anonKey,
    realtime: {
      channel(topic: string) {
        return supabase.channel(topic) as never;
      },
      removeChannel(channel: unknown) {
        return supabase.removeChannel(channel);
      },
    },
  });
}

function copyLists(lists: PriorityLists): PriorityLists {
  return { champions: [...lists.champions], components: [...lists.components] };
}
