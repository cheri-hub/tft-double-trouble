import { useMemo, useState } from 'react';

import { RoomCode } from './RoomCode';
import { createRoom, joinRoom } from './room-api';

export type ConnectedRoom = {
  roomId: string;
  participantToken: string;
};

type Props = {
  onConnected(room: ConnectedRoom): void;
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_room_id: 'UUID inválido.',
  room_not_found: 'Sala não encontrada.',
  room_expired: 'Esta sala expirou.',
  room_full: 'Esta sala já está cheia.',
  room_transport_not_configured: 'Conexão indisponível no momento.',
  room_request_failed: 'Não foi possível entrar na sala.',
  invalid_room_response: 'Resposta inválida do servidor.',
};

export function RoomEntry({ onConnected }: Props) {
  const [roomId, setRoomId] = useState('');
  const [createdRoom, setCreatedRoom] = useState<ConnectedRoom | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const canSubmit = useMemo(() => roomId.trim().length > 0, [roomId]);

  const connect = (room: ConnectedRoom) => {
    setCreatedRoom(room);
    onConnected(room);
  };

  const submitCreate = async () => {
    setError('');
    setIsBusy(true);
    try {
      const room = await createRoom();
      if (!room?.roomId || !room?.participantToken) {
        throw new Error('invalid_room_response');
      }
      connect(room);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setIsBusy(false);
    }
  };

  const submitJoin = async () => {
    setError('');
    setIsBusy(true);
    try {
      const room = await joinRoom(roomId.trim());
      if (!room?.roomId || !room?.participantToken) {
        throw new Error('invalid_room_response');
      }
      connect(room);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="room-entry" aria-label="Entrar na sala">
      <div className="room-entry-copy">
        <p className="eyebrow">Double Trouble TFT</p>
        <h1>Entre na sua sala</h1>
        <p>Crie uma sala nova ou cole o UUID de uma sala existente para começar.</p>
      </div>

      <div className="room-entry-actions">
        <button type="button" onClick={() => void submitCreate()} disabled={isBusy}>
          Criar sala
        </button>
        <label className="room-input">
          <span>UUID da sala</span>
          <input
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            disabled={isBusy}
            aria-label="UUID da sala"
          />
        </label>
        <button type="button" onClick={() => void submitJoin()} disabled={isBusy || !canSubmit}>
          Entrar com UUID
        </button>
      </div>

      {error ? <p className="room-error" role="alert">{error}</p> : null}
      {createdRoom ? <RoomCode roomId={createdRoom.roomId} /> : null}
    </section>
  );
}

function messageFor(error: unknown): string {
  const key =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'room_request_failed';
  return ERROR_MESSAGES[key] ?? ERROR_MESSAGES.room_request_failed;
}
