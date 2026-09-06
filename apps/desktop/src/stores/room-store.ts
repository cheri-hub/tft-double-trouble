import { useSyncExternalStore } from 'react';

import type { PriorityLists } from '../../../../packages/domain/src';
import { createSupabaseListAdapter, createSupabaseRoomClient } from '../lib/supabase';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline';
export type PartnerPresence = 'waiting' | 'online' | 'offline';
export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

export interface RoomTransport {
  update(roomId: string, participantToken: string, lists: PriorityLists): Promise<PriorityLists>;
  subscribe?(
    roomId: string,
    participantToken: string,
    onChange: (lists: PriorityLists) => void,
    onConnectionChange: (state: ConnectionState) => void,
    onPartnerPresenceChange: (state: PartnerPresence) => void,
  ): () => void;
}

export type RoomStoreState = {
  connection: ConnectionState;
  partnerPresence: PartnerPresence;
  saveStatus: SaveStatus;
  saveError: string | null;
  ownLists: PriorityLists;
  draftOwnLists: PriorityLists;
  partnerLists: PriorityLists;
  roomId: string | null;
  participantToken: string | null;
  setOwnLists(lists: PriorityLists): void;
  saveOwnLists(): Promise<void>;
  retrySave(): Promise<void>;
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
  let draftRevision = 0;
  let savePromise: Promise<void> | null = null;
  let state: RoomStoreState;

  const emit = () => listeners.forEach((listener) => listener());
  const setState = (patch: Partial<RoomStoreState>) => {
    state = { ...state, ...patch };
    emit();
  };

  state = {
    connection: 'offline',
    partnerPresence: 'waiting',
    saveStatus: 'saved',
    saveError: null,
    ownLists: emptyLists(),
    draftOwnLists: emptyLists(),
    partnerLists: emptyLists(),
    roomId: null,
    participantToken: null,
    setOwnLists(lists) {
      draftRevision += 1;
      setState({ draftOwnLists: copyLists(lists), saveStatus: 'unsaved', saveError: null });
    },
    async saveOwnLists() {
      if (savePromise) return savePromise;
      savePromise = (async () => {
        while (true) {
          const submittedRevision = draftRevision;
          const submittedLists = copyLists(state.draftOwnLists);
          setState({ saveStatus: 'saving', saveError: null });
          try {
            const confirmedLists = await transport.update(
              state.roomId ?? '',
              state.participantToken ?? '',
              submittedLists,
            );
            if (draftRevision === submittedRevision) {
              setState({
                ownLists: copyLists(confirmedLists),
                draftOwnLists: copyLists(confirmedLists),
                saveStatus: 'saved',
                saveError: null,
              });
              return;
            }
            setState({ ownLists: copyLists(confirmedLists), saveStatus: 'unsaved' });
          } catch (error) {
            setState({ saveStatus: 'error', saveError: errorMessage(error) });
            throw error;
          }
        }
      })().finally(() => { savePromise = null; });
      return savePromise;
    },
    retrySave() {
      return state.saveOwnLists();
    },
    connect(roomId, participantToken) {
      unsubscribe?.();
      unsubscribe = null;
      draftRevision = 0;
      savePromise = null;
      setState({
        roomId,
        participantToken,
        connection: 'connecting',
        partnerPresence: 'waiting',
        ownLists: emptyLists(),
        draftOwnLists: emptyLists(),
        partnerLists: emptyLists(),
        saveStatus: 'saved',
        saveError: null,
      });
      if (!transport.subscribe) return;
      unsubscribe = transport.subscribe(
        roomId,
        participantToken,
        (lists) => setState({ partnerLists: copyLists(lists) }),
        (connection) => setState({ connection }),
        (partnerPresence) => setState({ partnerPresence }),
      );
    },
    disconnect() {
      unsubscribe?.();
      unsubscribe = null;
      setState({
        roomId: null,
        participantToken: null,
        connection: 'offline',
        partnerPresence: 'waiting',
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
    subscribe(roomId, participantToken, onChange, onConnectionChange, onPartnerPresenceChange) {
      return resolve().subscribe?.(
        roomId,
        participantToken,
        onChange,
        onConnectionChange,
        onPartnerPresenceChange,
      ) ?? (() => undefined);
    },
  };
}

function createDefaultRoomTransport(): RoomTransport {
  if (import.meta.env.VITE_E2E_TEST === 'true') {
    const injectedTransport = (
      globalThis as typeof globalThis & { __DOUBLE_TROUBLE_E2E_TRANSPORT__?: RoomTransport }
    ).__DOUBLE_TROUBLE_E2E_TRANSPORT__;
    if (injectedTransport) return injectedTransport;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('room_transport_not_configured');
  }

  const client = createSupabaseRoomClient(supabaseUrl, anonKey);

  return createSupabaseListAdapter({
    functionsUrl: client.functionsUrl,
    anonKey: client.anonKey,
    realtime: client.realtime,
  });
}

function copyLists(lists: PriorityLists): PriorityLists {
  return { champions: [...lists.champions], components: [...lists.components] };
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'list_request_failed';
}
