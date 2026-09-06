import { useEffect, useState } from 'react';

import { CATALOG, type PriorityLists } from '../../../packages/domain/src';
import { CompactOverlay } from './features/overlay/CompactOverlay';
import { ExpandedOverlay } from './features/overlay/ExpandedOverlay';
import { RoomCode } from './features/room/RoomCode';
import { RoomEntry, type ConnectedRoom } from './features/room/RoomEntry';
import { enterOverlayMode, setOverlayExpanded } from './lib/window-settings';
import { useRoomStore } from './stores/room-store';

export default function App() {
  const [connectedRoom, setConnectedRoom] = useState<ConnectedRoom | null>(null);
  const [expanded, setExpanded] = useState(false);
  const connection = useRoomStore((state) => state.connection);
  const draftOwnLists = useRoomStore((state) => state.draftOwnLists);
  const partnerLists = useRoomStore((state) => state.partnerLists);

  useEffect(() => {
    document.documentElement.classList.toggle('overlay-active', connectedRoom !== null);
    return () => document.documentElement.classList.remove('overlay-active');
  }, [connectedRoom]);

  const handleConnected = (room: ConnectedRoom) => {
    useRoomStore.getState().connect(room.roomId, room.participantToken);
    setConnectedRoom(room);
    void enterOverlayMode()
      .then(setExpanded)
      .catch(() => undefined);
  };

  const changeExpanded = (nextExpanded: boolean) => {
    setExpanded(nextExpanded);
    void setOverlayExpanded(nextExpanded).catch(() => undefined);
  };

  const saveLists = (lists: PriorityLists) => {
    const store = useRoomStore.getState();
    store.setOwnLists(lists);
    void store.saveOwnLists().catch(() => undefined);
  };

  return (
    <main data-testid="app-root" className={`app-shell${connectedRoom ? ' overlay-mode' : ''}`}>
      {connectedRoom ? (
        <div className="overlay-stack">
          <div className="overlay-drag-region" data-tauri-drag-region aria-label="Mover overlay">
            <span>Double Trouble TFT</span>
          </div>
          <RoomCode roomId={connectedRoom.roomId} />
          {expanded ? (
            <ExpandedOverlay
              ownLists={draftOwnLists}
              catalog={CATALOG}
              onSave={saveLists}
              onCollapse={() => changeExpanded(false)}
            />
          ) : (
            <CompactOverlay
              partnerLists={partnerLists}
              connection={connection}
              onExpand={() => changeExpanded(true)}
            />
          )}
        </div>
      ) : (
        <RoomEntry onConnected={handleConnected} />
      )}
    </main>
  );
}
