import { CATALOG, type PriorityLists } from '../../../../../packages/domain/src';
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

const presenceLabels: Record<PartnerPresence, string> = {
  waiting: 'Aguardando parceiro',
  online: 'Parceiro conectado',
  offline: 'Parceiro offline — aguardando reconexão',
};

export function CompactOverlay({ partnerLists, connection, partnerPresence = 'waiting', onExpand }: CompactOverlayProps) {
  return (
    <section className="overlay overlay-compact" aria-label="Prioridades da dupla">
      <header className="overlay-header">
        <div>
          <p className={`connection-status connection-${connection}`}>{connectionLabels[connection]}</p>
          <h1>Prioridades da dupla</h1>
        </div>
        <button type="button" onClick={onExpand}>Expandir</button>
      </header>
      <p className={`partner-presence partner-${partnerPresence}`}>{presenceLabels[partnerPresence]}</p>
      <div className="priority-grid">
        <PriorityList title="Campeões" ids={partnerLists.champions} catalog={CATALOG} editable={false} />
        <PriorityList title="Componentes" ids={partnerLists.components} catalog={CATALOG} editable={false} />
      </div>
    </section>
  );
}
