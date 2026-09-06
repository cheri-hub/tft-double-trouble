import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CATALOG } from '../../../../../packages/domain/src';
import { CatalogPicker } from './CatalogPicker';
import { CompactOverlay } from './CompactOverlay';
import { ExpandedOverlay } from './ExpandedOverlay';
import type { ConnectionState } from '../../stores/room-store';

afterEach(cleanup);

class TestPointerEvent extends MouseEvent {
  readonly isPrimary: boolean;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.isPrimary = init.isPrimary ?? false;
  }
}

Object.defineProperty(window, 'PointerEvent', { configurable: true, value: TestPointerEvent });

describe('overlay', () => {
  it('shows partner lists in priority order and never exposes edit controls', () => {
    render(
      <CompactOverlay
        partnerLists={{ champions: ['ahri'], components: ['bf-sword'] }}
        connection="connected"
        partnerPresence="online"
        onExpand={vi.fn()}
      />,
    );

    expect(screen.getByText('1. Ahri')).toBeInTheDocument();
    expect(screen.getByText('1. B.F. Sword')).toBeInTheDocument();
    expect(screen.getByText('Conectado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remover/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mover/i })).not.toBeInTheDocument();
  });

  it.each<[ConnectionState, string]>([
    ['connecting', 'Conectando…'],
    ['connected', 'Conectado'],
    ['reconnecting', 'Reconectando…'],
    ['offline', 'Offline'],
  ])('renders the %s connection state as %s', (connection, label) => {
    render(
      <CompactOverlay
        partnerLists={{ champions: [], components: [] }}
        connection={connection}
        partnerPresence="waiting"
        onExpand={vi.fn()}
      />,
    );

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows empty partner-list states without changing the supplied lists', () => {
    const partnerLists = { champions: [] as string[], components: [] as string[] };
    render(<CompactOverlay partnerLists={partnerLists} connection="offline" partnerPresence="offline" onExpand={vi.fn()} />);

    expect(screen.getAllByText('Nenhuma prioridade adicionada.')).toHaveLength(2);
    expect(partnerLists).toEqual({ champions: [], components: [] });
  });

  it.each([
    ['waiting', 'Aguardando parceiro'],
    ['offline', 'Parceiro offline — aguardando reconexão'],
    ['online', 'Parceiro conectado'],
  ] as const)('shows %s partner presence as %s', (partnerPresence, label) => {
    render(
      <CompactOverlay
        partnerLists={{ champions: [], components: [] }}
        connection="connected"
        partnerPresence={partnerPresence}
        onExpand={vi.fn()}
      />,
    );
    expect(screen.getByText(label)).toBeInTheDocument();
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

  it('surfaces an unsaved list error and offers retry', () => {
    const onRetry = vi.fn();
    render(
      <ExpandedOverlay
        ownLists={{ champions: ['ahri'], components: [] }}
        catalog={CATALOG}
        onSave={vi.fn()}
        onCollapse={vi.fn()}
        saveStatus="error"
        saveError="offline"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Alterações não salvas');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar salvar novamente' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('locks catalog add controls when the category already has ten entries', () => {
    const tenChampions = CATALOG.filter((entry) => entry.category === 'champion')
      .slice(0, 10)
      .map((entry) => entry.id);
    render(
      <ExpandedOverlay
        ownLists={{ champions: tenChampions, components: [] }}
        catalog={CATALOG}
        onSave={vi.fn()}
        onCollapse={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Buscar campeão' })).toBeDisabled();
    expect(screen.getByPlaceholderText('Limite de 10 atingido')).toBeDisabled();
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

  it('reorders through the configured dnd-kit keyboard sensor', async () => {
    const onSave = vi.fn();
    render(
      <ExpandedOverlay
        ownLists={{ champions: ['ahri', 'akali'], components: [] }}
        catalog={CATALOG}
        onSave={onSave}
        onCollapse={vi.fn()}
      />,
    );

    const handle = screen.getByRole('button', { name: 'Arrastar Ahri' });
    setSortableRects(handle, screen.getByRole('button', { name: 'Arrastar Akali' }));
    handle.focus();
    fireEvent.keyDown(handle, { code: 'Space' });
    await settleDnd();
    fireEvent.keyDown(document, { code: 'ArrowDown' });
    await settleDnd();
    fireEvent.keyDown(document, { code: 'Space' });
    await settleDnd();

    expect(onSave).toHaveBeenLastCalledWith({ champions: ['akali', 'ahri'], components: [] });
  });

  it('reorders through the configured dnd-kit pointer sensor', async () => {
    const onSave = vi.fn();
    render(
      <ExpandedOverlay
        ownLists={{ champions: ['ahri', 'akali'], components: [] }}
        catalog={CATALOG}
        onSave={onSave}
        onCollapse={vi.fn()}
      />,
    );

    const ahriHandle = screen.getByRole('button', { name: 'Arrastar Ahri' });
    const akaliHandle = screen.getByRole('button', { name: 'Arrastar Akali' });
    setSortableRects(ahriHandle, akaliHandle);

    fireEvent.pointerDown(ahriHandle, { button: 0, clientX: 10, clientY: 10, isPrimary: true });
    await settleDnd();
    fireEvent.pointerMove(document, { clientX: 10, clientY: 70, isPrimary: true });
    await settleDnd();
    fireEvent.pointerUp(document, { clientX: 10, clientY: 70, isPrimary: true });
    await settleDnd();

    expect(onSave).toHaveBeenLastCalledWith({ champions: ['akali', 'ahri'], components: [] });
  });
});

function setSortableRects(firstHandle: HTMLElement, secondHandle: HTMLElement) {
  vi.spyOn(firstHandle.closest('li')!, 'getBoundingClientRect').mockReturnValue(rect(0));
  vi.spyOn(secondHandle.closest('li')!, 'getBoundingClientRect').mockReturnValue(rect(50));
}

async function settleDnd() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

function rect(top: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    right: 200,
    bottom: top + 40,
    width: 200,
    height: 40,
    toJSON: () => ({}),
  };
}
