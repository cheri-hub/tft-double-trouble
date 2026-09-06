import { useState } from 'react';

import { Button } from '../../components/ui/button';

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
    <section
      className="room-code-card flex items-center gap-2 rounded-md border border-edge bg-bg/70 px-2 py-1 backdrop-blur-md"
      aria-label="Código da sala"
    >
      <span className="font-display text-[10px] font-semibold tracking-[0.16em] text-ink-dim uppercase">
        Sala
      </span>
      <strong
        className="room-code min-w-0 flex-1 truncate font-mono text-[11px] font-normal text-ink"
        title={roomId}
      >
        {roomId}
      </strong>
      <Button variant="subtle" size="sm" className="shrink-0" onClick={() => void copy()}>
        {copied ? 'Copiado' : 'Copiar UUID'}
      </Button>
    </section>
  );
}
