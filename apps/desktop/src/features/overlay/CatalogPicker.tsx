import { useId, useMemo, useState } from 'react';

import { CATALOG, type Category } from '../../../../../packages/domain/src';
import { ScrollArea } from '../../components/ui/scroll-area';

type CatalogPickerProps = {
  category: Category;
  selectedIds: string[];
  onAdd: (id: string) => void;
};

const labels: Record<Category, string> = {
  champion: 'campeão',
  component: 'componente',
};

const pluralLabels: Record<Category, string> = {
  champion: 'campeões',
  component: 'componentes',
};

export function CatalogPicker({ category, selectedIds, onAdd }: CatalogPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const resultsId = useId();
  const atLimit = selectedIds.length >= 10;
  const categoryLabel = labels[category];
  const showResults = open || query.trim().length > 0;

  const entries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return CATALOG.filter((entry) => entry.category === category)
      .filter((entry) => entry.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [category, query]);

  const add = (id: string) => {
    if (!atLimit && !selectedIds.includes(id)) {
      onAdd(id);
      setQuery('');
    }
  };

  return (
    <div
      className="catalog-picker grid gap-1.5"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label className="grid gap-1">
        <span className="font-display text-[10px] font-semibold tracking-[0.14em] text-ink-dim uppercase">
          Buscar {categoryLabel}
        </span>
        <input
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls={resultsId}
          aria-label={`Buscar ${categoryLabel}`}
          value={query}
          disabled={atLimit}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              setQuery('');
            }
          }}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={atLimit ? 'Limite de 10 atingido' : `Clique para ver todos os ${pluralLabels[category]}`}
          className="h-8 rounded-lg border border-edge bg-raise px-2.5 text-xs text-ink placeholder:text-ink-dim focus-visible:border-edge-strong disabled:opacity-50"
        />
      </label>
      {showResults && (
        <ScrollArea className="max-h-40 rounded-lg border border-edge bg-raise/60">
          <div
            id={resultsId}
            className="grid gap-0.5 p-1"
            role="listbox"
            aria-label={`Resultados de ${categoryLabel}`}
          >
            {entries.map((entry) => {
              const selected = selectedIds.includes(entry.id);
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={selected || atLimit}
                  key={entry.id}
                  onClick={() => add(entry.id)}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs text-ink transition-colors hover:bg-raise disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <img className="size-5 shrink-0 rounded object-cover" src={entry.icon} alt="" loading="lazy" />
                  <span className="truncate">{entry.name}</span>
                </button>
              );
            })}
            {entries.length === 0 && <p className="px-1.5 py-1 text-xs text-ink-dim">Nenhum resultado.</p>}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
