import { useEffect, useRef, useState } from 'react';

import { CATALOG, type PriorityLists } from '../../../packages/domain/src';
import { CompactOverlay } from './features/overlay/CompactOverlay';
import { ExpandedOverlay } from './features/overlay/ExpandedOverlay';
import { RoomCode } from './features/room/RoomCode';
import { RoomEntry, type ConnectedRoom } from './features/room/RoomEntry';
import { Button } from './components/ui/button';
import { closeOverlay, enterOverlayMode, setOverlayExpanded, watchOverlayContent } from './lib/window-settings';
import { useRoomStore } from './stores/room-store';

export default function App() {
  const [connectedRoom, setConnectedRoom] = useState<ConnectedRoom | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const overlayStackRef = useRef<HTMLDivElement>(null);
  const connection = useRoomStore((state) => state.connection);
  const partnerPresence = useRoomStore((state) => state.partnerPresence);
  const saveStatus = useRoomStore((state) => state.saveStatus);
  const saveError = useRoomStore((state) => state.saveError);
  const draftOwnLists = useRoomStore((state) => state.draftOwnLists);
  const partnerLists = useRoomStore((state) => state.partnerLists);

  useEffect(() => {
    document.documentElement.classList.toggle('overlay-active', connectedRoom !== null);
    return () => document.documentElement.classList.remove('overlay-active');
  }, [connectedRoom]);

  useEffect(() => {
    if (!connectedRoom || !overlayStackRef.current) return;
    return watchOverlayContent(overlayStackRef.current);
  }, [connectedRoom]);

  useEffect(() => {
    if (!connectedRoom) return;
    const leave = () => useRoomStore.getState().disconnect();
    window.addEventListener('pagehide', leave);
    window.addEventListener('beforeunload', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('beforeunload', leave);
    };
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

  const leaveAndClose = () => {
    useRoomStore.getState().disconnect();
    void closeOverlay().catch(() => undefined);
  };

  return (
    <main
      data-testid="app-root"
      className={
        connectedRoom
          ? 'app-shell overlay-mode min-h-screen'
          : 'app-shell grid min-h-screen place-content-center p-4'
      }
    >
      {connectedRoom ? (
        <div
          ref={overlayStackRef}
          className="overlay-stack grid min-w-0 max-w-full content-start gap-1.5 [&>*]:min-w-0"
        >
          {confirmClose ? (
            <div className="flex min-h-[22px] items-center justify-between gap-2 rounded-md border border-danger/50 bg-bg/80 px-2 backdrop-blur-md">
              <span className="font-display text-[10px] font-semibold tracking-[0.14em] text-danger uppercase">
                Fechar overlay?
              </span>
              <span className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-5 border-danger text-danger" onClick={leaveAndClose}>
                  Fechar
                </Button>
                <Button variant="subtle" size="sm" className="h-5" onClick={() => setConfirmClose(false)}>
                  Cancelar
                </Button>
              </span>
            </div>
          ) : (
            <div className="flex min-h-[18px] items-center gap-1 rounded-md bg-bg/70 pr-1 pl-2 backdrop-blur-md">
              <div
                className="overlay-drag-region flex flex-1 cursor-grab items-center self-stretch select-none"
                data-tauri-drag-region
                aria-label="Mover overlay"
              >
                <span className="pointer-events-none font-display text-[10px] font-semibold tracking-[0.18em] text-ink-dim uppercase">
                  Double Trouble TFT
                </span>
              </div>
              <Button
                variant="icon"
                size="icon"
                className="size-4 shrink-0 text-sm hover:text-danger"
                aria-label="Fechar overlay"
                onClick={() => setConfirmClose(true)}
              >
                <span aria-hidden="true">×</span>
              </Button>
            </div>
          )}
          <RoomCode roomId={connectedRoom.roomId} />
          {expanded ? (
            <ExpandedOverlay
              ownLists={draftOwnLists}
              catalog={CATALOG}
              onSave={saveLists}
              onCollapse={() => changeExpanded(false)}
              saveStatus={saveStatus}
              saveError={saveError}
              onRetry={() => { void useRoomStore.getState().retrySave().catch(() => undefined); }}
            />
          ) : (
            <CompactOverlay
              partnerLists={partnerLists}
              connection={connection}
              partnerPresence={partnerPresence}
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
