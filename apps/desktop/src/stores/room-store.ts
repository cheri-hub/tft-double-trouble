import { useSyncExternalStore } from 'react';

import type { PriorityLists } from '../../../../packages/domain/src';

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

const emptyLists = (): PriorityLists => ({ champions: [], components: [] });

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
      const confirmed = await transport.update(
        state.roomId ?? '',
        state.participantToken ?? '',
        copyLists(state.draftOwnLists),
      );
      setState({ ownLists: copyLists(confirmed), draftOwnLists: copyLists(confirmed) });
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

export const useRoomStore = makeRoomStore({
  async update() {
    throw new Error('room_transport_not_configured');
  },
});

function copyLists(lists: PriorityLists): PriorityLists {
  return { champions: [...lists.champions], components: [...lists.components] };
}
