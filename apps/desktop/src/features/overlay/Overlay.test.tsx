import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CATALOG } from '../../../../../packages/domain/src';
import { CatalogPicker } from './CatalogPicker';
import { CompactOverlay } from './CompactOverlay';
import { ExpandedOverlay } from './ExpandedOverlay';

afterEach(cleanup);

describe('overlay', () => {
  it('shows partner lists in priority order and never exposes edit controls', () => {
    render(
      <CompactOverlay
        partnerLists={{ champions: ['ahri'], components: ['bf-sword'] }}
        connection="connected"
        onExpand={vi.fn()}
      />,
    );

    expect(screen.getByText('1. Ahri')).toBeInTheDocument();
    expect(screen.getByText('1. B.F. Sword')).toBeInTheDocument();
    expect(screen.getByText('Conectado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remover/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mover/i })).not.toBeInTheDocument();
  });

  it('filters catalog options and never emits an already selected id', () => {
    const onAdd = vi.fn();
    render(<CatalogPicker category="champion" selectedIds={['ahri']} onAdd={onAdd} />);

    const picker = screen.getByRole('combobox', { name: 'Buscar campeão' });
    expect(picker).toHaveAttribute('aria-controls');
    fireEvent.change(picker, {
      target: { value: 'Ahri' },
    });

    const option = screen.getByRole('option', { name: 'Ahri' });
    expect(option).toBeDisabled();
    fireEvent.click(option);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('adds and removes only local entries', () => {
    const onSave = vi.fn();
    render(
      <ExpandedOverlay
        ownLists={{ champions: [], components: [] }}
        catalog={CATALOG}
        onSave={onSave}
        onCollapse={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Buscar campeão' }), {
      target: { value: 'Ahri' },
    });
    fireEvent.click(screen.getByRole('option', { name: 'Ahri' }));
    expect(onSave).toHaveBeenLastCalledWith({ champions: ['ahri'], components: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Remover Ahri' }));
    expect(onSave).toHaveBeenLastCalledWith({ champions: [], components: [] });
  });

  it('reorders one local category without changing the other', () => {
    const onSave = vi.fn();
    render(
      <ExpandedOverlay
        ownLists={{ champions: ['ahri', 'akali'], components: ['bf-sword'] }}
        catalog={CATALOG}
        onSave={onSave}
        onCollapse={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mover Ahri para baixo' }));
    expect(onSave).toHaveBeenLastCalledWith({
      champions: ['akali', 'ahri'],
      components: ['bf-sword'],
    });
  });
});
