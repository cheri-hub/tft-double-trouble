import { useEffect, useState } from 'react';

import type { CatalogEntry, PriorityLists } from '../../../../../packages/domain/src';

import { CatalogPicker } from './CatalogPicker';
import { PriorityList } from './PriorityList';

type ExpandedOverlayProps = {
  ownLists: PriorityLists;
  catalog: readonly CatalogEntry[];
  onSave: (lists: PriorityLists) => void;
  onCollapse: () => void;
};

function copyLists(lists: PriorityLists): PriorityLists {
  return { champions: [...lists.champions], components: [...lists.components] };
}
export function ExpandedOverlay({ ownLists, catalog, onSave, onCollapse }: ExpandedOverlayProps) {
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
