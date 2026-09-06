import { cleanup, render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import * as api from './features/room/room-api';

const { connect, enterOverlayMode, setOverlayExpanded } = vi.hoisted(() => ({
  connect: vi.fn(),
  enterOverlayMode: vi.fn().mockResolvedValue(false),
  setOverlayExpanded: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./features/room/room-api', () => ({
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
}));

vi.mock('./stores/room-store', () => {
  const state = {
    connection: 'connected',
    ownLists: { champions: [], components: [] },
    draftOwnLists: { champions: [], components: [] },
    partnerLists: { champions: [], components: [] },
    connect,
    setOwnLists: vi.fn(),
    saveOwnLists: vi.fn().mockResolvedValue(undefined),
  };
  const useRoomStore = Object.assign((selector: (value: typeof state) => unknown) => selector(state), {
    getState: () => state,
  });
  return { useRoomStore };
});

vi.mock('./lib/window-settings', () => ({ enterOverlayMode, setOverlayExpanded }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.createRoom).mockReset();
  vi.mocked(api.joinRoom).mockReset();
  enterOverlayMode.mockResolvedValue(false);
  setOverlayExpanded.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('App', () => {
  it('renders the Double Trouble TFT root', () => {
    render(<App />);
    expect(screen.getByTestId('app-root')).toHaveTextContent('Double Trouble TFT');
  });

  it('shows the copyable room UUID after creating a room', async () => {
    vi.mocked(api.createRoom).mockResolvedValue({ roomId: 'room-uuid', participantToken: 'token' });

    render(<App />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Criar sala' })[0]);

    expect(await screen.findByText('room-uuid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar UUID' })).toBeInTheDocument();
  });

  it('transitions the same window to the compact overlay after connecting', async () => {
    vi.mocked(api.createRoom).mockResolvedValue({ roomId: 'room-uuid', participantToken: 'token' });

    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Criar sala' })[0]);

    expect(await screen.findByRole('heading', { name: 'Prioridades da dupla' })).toBeInTheDocument();
    expect(enterOverlayMode).toHaveBeenCalledTimes(1);
  });

  it('uses the same native window when expanding the overlay', async () => {
    vi.mocked(api.createRoom).mockResolvedValue({ roomId: 'room-uuid', participantToken: 'token' });

    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Criar sala' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Expandir' }));

    expect(setOverlayExpanded).toHaveBeenCalledWith(true);
    expect(await screen.findByRole('heading', { name: 'Editar prioridades' })).toBeInTheDocument();
  });
});
