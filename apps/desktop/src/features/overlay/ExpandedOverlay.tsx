import { useEffect, useState } from 'react';

import type { CatalogEntry, PriorityLists } from '../../../../../packages/domain/src';
import type { SaveStatus } from '../../stores/room-store';

import { CatalogPicker } from './CatalogPicker';
import { PriorityList } from './PriorityList';

type ExpandedOverlayProps = {
  ownLists: PriorityLists;
  catalog: readonly CatalogEntry[];
  onSave: (lists: PriorityLists) => void;
  onCollapse: () => void;
  saveStatus?: SaveStatus;
  saveError?: string | null;
  onRetry?: () => void;
};

function copyLists(lists: PriorityLists): PriorityLists {
  return { champions: [...lists.champions], components: [...lists.components] };
}
export function ExpandedOverlay({
  ownLists,
  catalog,
  onSave,
  onCollapse,
  saveStatus = 'saved',
  saveError = null,
  onRetry = () => undefined,
}: ExpandedOverlayProps) {
  const [draft, setDraft] = useState(() => copyLists(ownLists));

  useEffect(() => setDraft(copyLists(ownLists)), [ownLists]);

  const update = (next: PriorityLists) => {
    setDraft(next);
    onSave(copyLists(next));
  };

  const add = (category: keyof PriorityLists, id: string) => {
    const ids = draft[category];
    if (ids.length >= 10 || ids.includes(id)) return;
    update({ ...draft, [category]: [...ids, id] });
  };

  const remove = (category: keyof PriorityLists, id: string) => {
    update({ ...draft, [category]: draft[category].filter((entryId) => entryId !== id) });
  };

  const reorder = (category: keyof PriorityLists, ids: string[]) => {
    update({ ...draft, [category]: ids });
  };

  return (
    <section className="overlay overlay-expanded" aria-label="Editar minhas prioridades">
      <header className="overlay-header">
        <div>
          <p className="eyebrow">Minha lista</p>
          <h1>Editar prioridades</h1>
        </div>
        <button type="button" onClick={onCollapse}>Recolher</button>
      </header>
      <div className={`save-state save-${saveStatus}`} aria-live="polite">
        {saveStatus === 'saving' && <p>Salvando alterações…</p>}
        {saveStatus === 'unsaved' && <p>Alterações ainda não salvas.</p>}
        {saveStatus === 'saved' && <p>Alterações salvas.</p>}
        {saveStatus === 'error' && (
          <div role="alert">
            <p>Alterações não salvas. {friendlySaveError(saveError)}</p>
            <button type="button" onClick={onRetry}>Tentar salvar novamente</button>
          </div>
        )}
      </div>
      <div className="priority-grid">
        <div className="priority-editor">
          <PriorityList
            title="Campeões"
            ids={draft.champions}
            catalog={catalog}
            editable
            onRemove={(id) => remove('champions', id)}
            onReorder={(ids) => reorder('champions', ids)}
          />
          <CatalogPicker category="champion" selectedIds={draft.champions} onAdd={(id) => add('champions', id)} />
        </div>
        <div className="priority-editor">
          <PriorityList
            title="Componentes"
            ids={draft.components}
            catalog={catalog}
            editable
            onRemove={(id) => remove('components', id)}
            onReorder={(ids) => reorder('components', ids)}
          />
          <CatalogPicker category="component" selectedIds={draft.components} onAdd={(id) => add('components', id)} />
        </div>
      </div>
    </section>
  );
}

function friendlySaveError(error: string | null): string {
  return error === 'offline' ? 'Sem conexão com o servidor.' : 'Verifique a conexão e tente novamente.';
}
