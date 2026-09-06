import { useState } from 'react';

import { RoomCode } from './features/room/RoomCode';
import { RoomEntry, type ConnectedRoom } from './features/room/RoomEntry';
import { useRoomStore } from './stores/room-store';

export default function App() {
  const [connectedRoom, setConnectedRoom] = useState<ConnectedRoom | null>(null);

  const handleConnected = (room: ConnectedRoom) => {
    useRoomStore.getState().connect(room.roomId, room.participantToken);
    setConnectedRoom(room);
  };

  return (
    <main data-testid="app-root" className="app-shell">
      {connectedRoom ? (
        <section className="overlay-shell" aria-label="Overlay da sala">
          <p className="eyebrow">Sala conectada</p>
          <h1>{connectedRoom.roomId}</h1>
          <p>Você já pode controlar a dupla neste espaço.</p>
          <RoomCode roomId={connectedRoom.roomId} />
        </section>
      ) : (
        <RoomEntry onConnected={handleConnected} />
      )}
    </main>
  );
}
