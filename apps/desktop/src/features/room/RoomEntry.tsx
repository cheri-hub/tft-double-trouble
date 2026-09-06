import { useMemo, useState } from 'react';

import { Button } from '../../components/ui/button';

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
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const canSubmit = useMemo(() => roomId.trim().length > 0, [roomId]);

  const submitCreate = async () => {
    setError('');
    setIsBusy(true);
    try {
      const room = await createRoom();
      if (!room?.roomId || !room?.participantToken) {
        throw new Error('invalid_room_response');
      }
      onConnected(room);
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
      onConnected(room);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section
      className="room-entry wm-stagger grid w-[min(340px,100%)] gap-3 rounded-xl border border-edge bg-bg p-5 shadow-2xl shadow-black/40 backdrop-blur-md
        before:pointer-events-none before:absolute before:inset-x-6 before:-top-px before:h-px before:bg-gradient-to-r before:from-transparent before:via-gold before:to-transparent
        relative"
      aria-label="Entrar na sala"
    >
      <div className="grid gap-1">
        <p className="font-display text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
          Double Trouble TFT
        </p>
        <h1 className="font-display text-xl font-semibold tracking-wide text-ink">Entre na sua sala</h1>
        <p className="text-xs text-ink-dim">
          Crie uma sala nova ou cole o UUID de uma sala existente para começar.
        </p>
      </div>

      <Button variant="primary" size="md" onClick={() => void submitCreate()} disabled={isBusy}>
        Criar sala
      </Button>

      <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] text-ink-dim uppercase">
        <span className="h-px flex-1 bg-edge" />
        ou
        <span className="h-px flex-1 bg-edge" />
      </div>

      <label className="grid gap-1">
        <span className="font-display text-[10px] font-semibold tracking-[0.14em] text-ink-dim uppercase">
          UUID da sala
        </span>
        <input
          value={roomId}
          onChange={(event) => setRoomId(event.target.value)}
          placeholder="00000000-0000-0000-0000-000000000000"
          disabled={isBusy}
          aria-label="UUID da sala"
          className="h-8 rounded-lg border border-edge bg-raise px-2.5 font-mono text-xs text-ink placeholder:text-ink-dim focus-visible:border-edge-strong disabled:opacity-50"
        />
      </label>
      <Button
        variant="ghost"
        size="md"
        onClick={() => void submitJoin()}
        disabled={isBusy || !canSubmit}
      >
        Entrar com UUID
      </Button>

      {error ? (
        <p className="room-error text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
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
