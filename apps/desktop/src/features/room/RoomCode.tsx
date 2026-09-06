import { useState } from 'react';

type RoomCodeProps = {
  roomId: string;
};

export function RoomCode({ roomId }: RoomCodeProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(roomId);
    setCopied(true);
  };

  return (
    <section className="room-code-card" aria-label="Código da sala">
      <div>
        <p className="eyebrow">UUID da sala</p>
        <strong className="room-code">{roomId}</strong>
      </div>
      <button type="button" onClick={() => void copy()}>
        {copied ? 'Copiado' : 'Copiar UUID'}
      </button>
    </section>
  );
}
