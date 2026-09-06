import { CATALOG, type PriorityLists } from '../../../../../packages/domain/src';

import { PriorityList } from './PriorityList';

type CompactOverlayProps = {
  partnerLists: PriorityLists;
  connection: 'connected' | 'connecting' | 'disconnected';
  onExpand: () => void;
};

const connectionLabels: Record<CompactOverlayProps['connection'], string> = {
  connected: 'Conectado',
  connecting: 'Conectando…',
  disconnected: 'Desconectado',
};

export function CompactOverlay({ partnerLists, connection, onExpand }: CompactOverlayProps) {
  return (
    <section className="overlay overlay-compact" aria-label="Prioridades da dupla">
      <header className="overlay-header">
        <div>
          <p className={`connection-status connection-${connection}`}>{connectionLabels[connection]}</p>
          <h1>Prioridades da dupla</h1>
        </div>
        <button type="button" onClick={onExpand}>Expandir</button>
      </header>
      <div className="priority-grid">
        <PriorityList title="Campeões" ids={partnerLists.champions} catalog={CATALOG} editable={false} />
        <PriorityList title="Componentes" ids={partnerLists.components} catalog={CATALOG} editable={false} />
      </div>
    </section>
  );
}
