import { useEffect, useRef, useState } from 'react';

import type { CatalogEntry, PriorityLists } from '../../../../../packages/domain/src';
import { Button } from '../../components/ui/button';
import { ScrollArea } from '../../components/ui/scroll-area';
import { StatusDot, type Tone } from '../../components/ui/status-dot';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
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

type Tab = keyof PriorityLists;

const SAVE_TONE: Record<SaveStatus, Tone> = {
  saved: 'positive',
  saving: 'warn',
  unsaved: 'warn',
  error: 'danger',
};

const SAVE_LABEL: Record<Exclude<SaveStatus, 'error'>, string> = {
  saving: 'Salvando alterações…',
  unsaved: 'Alterações ainda não salvas.',
  saved: 'Alterações salvas.',
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
  const [tab, setTab] = useState<Tab>('champions');
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => setDraft(copyLists(ownLists)), [ownLists]);

  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  const hasEntries = draft.champions.length > 0 || draft.components.length > 0;

  const update = (next: PriorityLists) => {
    setDraft(next);
    onSave(copyLists(next));
  };

  const add = (category: Tab, id: string) => {
    const ids = draft[category];
    if (ids.length >= 10 || ids.includes(id)) return;
    update({ ...draft, [category]: [...ids, id] });
  };

  const remove = (category: Tab, id: string) => {
    update({ ...draft, [category]: draft[category].filter((entryId) => entryId !== id) });
  };

  const reorder = (category: Tab, ids: string[]) => {
    update({ ...draft, [category]: ids });
  };

  const clearAll = () => {
    clearTimeout(confirmTimer.current);
    if (!confirmClear) {
      setConfirmClear(true);
      confirmTimer.current = setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setConfirmClear(false);
    update({ champions: [], components: [] });
  };

  return (
    <section
      className="overlay overlay-expanded wm-stagger flex flex-col gap-2 rounded-xl border border-edge bg-bg p-3 shadow-xl shadow-black/40 backdrop-blur-md"
      aria-label="Editar minhas prioridades"
    >
      <header className="flex items-center justify-between gap-2 border-b border-edge pb-2">
        <div>
          <p className="font-display text-[10px] font-semibold tracking-[0.16em] text-gold uppercase">
            Minha lista
          </p>
          <h1 className="font-display text-base font-semibold tracking-wide text-ink">
            Editar prioridades
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onCollapse}>
          Recolher
        </Button>
      </header>

      <div
        className={`save-state save-${saveStatus} flex min-h-6 items-center gap-1.5 text-[11px]`}
        aria-live="polite"
      >
        <StatusDot tone={SAVE_TONE[saveStatus]} pulse={saveStatus === 'saving'} />
        {saveStatus === 'error' ? (
          <div role="alert" className="flex items-center gap-2 text-danger">
            <span>Alterações não salvas. {friendlySaveError(saveError)}</span>
            <Button variant="ghost" size="sm" className="h-6" onClick={onRetry}>
              Tentar salvar novamente
            </Button>
          </div>
        ) : (
          <span className="text-ink-dim">{SAVE_LABEL[saveStatus]}</span>
        )}
      </div>

      {hasEntries && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className={confirmClear ? 'border-danger text-danger' : 'text-ink-dim'}
            aria-label={confirmClear ? 'Confirmar limpeza de todas as prioridades' : 'Limpar todas as prioridades'}
            onClick={clearAll}
          >
            {confirmClear ? 'Confirmar limpeza?' : 'Limpar tudo'}
          </Button>
        </div>
      )}

      <ToggleGroup
        type="single"
        value={tab}
        onValueChange={(next) => next && setTab(next as Tab)}
        aria-label="Categoria em edição"
        className="w-full"
      >
        <ToggleGroupItem value="champions">Campeões</ToggleGroupItem>
        <ToggleGroupItem value="components">Componentes</ToggleGroupItem>
      </ToggleGroup>

      <div className="grid gap-2">
        <ScrollArea className="max-h-[240px] pr-1" viewportClassName="pr-1">
          {tab === 'champions' ? (
            <PriorityList
              title="Campeões"
              ids={draft.champions}
              catalog={catalog}
              editable
              cap={10}
              onRemove={(id) => remove('champions', id)}
              onReorder={(ids) => reorder('champions', ids)}
            />
          ) : (
            <PriorityList
              title="Componentes"
              ids={draft.components}
              catalog={catalog}
              editable
              cap={10}
              onRemove={(id) => remove('components', id)}
              onReorder={(ids) => reorder('components', ids)}
            />
          )}
        </ScrollArea>

        {tab === 'champions' ? (
          <CatalogPicker
            category="champion"
            selectedIds={draft.champions}
            onAdd={(id) => add('champions', id)}
          />
        ) : (
          <CatalogPicker
            category="component"
            selectedIds={draft.components}
            onAdd={(id) => add('components', id)}
          />
        )}
      </div>
    </section>
  );
}

function friendlySaveError(error: string | null): string {
  return error === 'offline' ? 'Sem conexão com o servidor.' : 'Verifique a conexão e tente novamente.';
}
