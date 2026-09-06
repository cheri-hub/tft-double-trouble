import { useId, useMemo, useState } from 'react';

import { CATALOG, type Category } from '../../../../../packages/domain/src';

type CatalogPickerProps = {
  category: Category;
  selectedIds: string[];
  onAdd: (id: string) => void;
};

const labels: Record<Category, string> = {
  champion: 'campeão',
  component: 'componente',
};

export function CatalogPicker({ category, selectedIds, onAdd }: CatalogPickerProps) {
  const [query, setQuery] = useState('');
  const resultsId = useId();
  const atLimit = selectedIds.length >= 10;
  const categoryLabel = labels[category];
  const entries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return CATALOG.filter((entry) => entry.category === category)
      .filter((entry) => entry.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
  }, [category, query]);

  const add = (id: string) => {
    if (!atLimit && !selectedIds.includes(id)) {
      onAdd(id);
      setQuery('');
    }
  };

  return (
    <div className="catalog-picker">
      <label>
        <span>Buscar {categoryLabel}</span>
        <input
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={query.length > 0}
          aria-controls={resultsId}
          aria-label={`Buscar ${categoryLabel}`}
          value={query}
          disabled={atLimit}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={atLimit ? 'Limite de 10 atingido' : `Digite o nome do ${categoryLabel}`}
        />
      </label>
      {query.length > 0 && (
        <div id={resultsId} className="catalog-options" role="listbox" aria-label={`Resultados de ${categoryLabel}`}>
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
              >
                {entry.name}
              </button>
            );
          })}
          {entries.length === 0 && <p>Nenhum resultado.</p>}
        </div>
      )}
    </div>
  );
}
