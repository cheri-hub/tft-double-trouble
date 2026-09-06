import { CATALOG, type PriorityLists } from '../../../../../packages/domain/src';
import { Button } from '../../components/ui/button';
import { ScrollArea } from '../../components/ui/scroll-area';
import { StatusDot, type Tone } from '../../components/ui/status-dot';
import type { ConnectionState, PartnerPresence } from '../../stores/room-store';

import { PriorityList } from './PriorityList';

type CompactOverlayProps = {
  partnerLists: PriorityLists;
  connection: ConnectionState;
  partnerPresence?: PartnerPresence;
  onExpand: () => void;
};

const connectionLabels: Record<CompactOverlayProps['connection'], string> = {
  connected: 'Conectado',
  connecting: 'Conectando…',
  reconnecting: 'Reconectando…',
  offline: 'Offline',
};

const connectionTone: Record<ConnectionState, Tone> = {
  connected: 'positive',
  connecting: 'warn',
  reconnecting: 'warn',
  offline: 'danger',
};

const presenceLabels: Record<PartnerPresence, string> = {
  waiting: 'Aguardando parceiro',
  online: 'Parceiro conectado',
  offline: 'Parceiro offline — aguardando reconexão',
};

const presenceTone: Record<PartnerPresence, Tone> = {
  waiting: 'idle',
  online: 'positive',
  offline: 'warn',
};

export function CompactOverlay({
  partnerLists,
  connection,
  partnerPresence = 'waiting',
  onExpand,
}: CompactOverlayProps) {
  const connecting = connection === 'connecting' || connection === 'reconnecting';

  return (
    <section
      className="overlay overlay-compact wm-stagger flex flex-col gap-2 rounded-xl border border-edge bg-bg p-2 shadow-xl shadow-black/40 backdrop-blur-md"
      aria-label="Prioridades da dupla"
    >
      <h1 className="sr-only">Prioridades da dupla</h1>

      <header className="flex items-center justify-between gap-2 border-b border-edge pb-1.5">
        <div
          className={`connection-status connection-${connection} flex items-center gap-1.5`}
        >
          <StatusDot tone={connectionTone[connection]} pulse={connecting} />
          <span className="font-display text-[10px] font-semibold tracking-[0.14em] text-ink-dim uppercase">
            {connectionLabels[connection]}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onExpand}>
          Expandir
        </Button>
      </header>

      <p
        className={`partner-presence partner-${partnerPresence} flex items-center gap-1.5 text-[11px] text-ink-dim`}
      >
        <StatusDot tone={presenceTone[partnerPresence]} />
        {presenceLabels[partnerPresence]}
      </p>

      <ScrollArea className="-mr-1 max-h-[420px] flex-1 pr-1" viewportClassName="pr-1">
        <div className="grid gap-3">
          <PriorityList
            title="Campeões"
            ids={partnerLists.champions}
            catalog={CATALOG}
            editable={false}
            cap={10}
          />
          <PriorityList
            title="Componentes"
            ids={partnerLists.components}
            catalog={CATALOG}
            editable={false}
            cap={10}
          />
        </div>
      </ScrollArea>
    </section>
  );
}
