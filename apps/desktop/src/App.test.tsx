import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import * as api from './features/room/room-api';

vi.mock('./features/room/room-api', () => ({
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
}));

vi.mock('./stores/room-store', () => ({
  useRoomStore: {
    getState: () => ({
      connect: vi.fn(),
    }),
  },
}));

describe('App', () => {
  it('renders the Double Trouble TFT root', () => {
    render(<App />);
    expect(screen.getByTestId('app-root')).toHaveTextContent('Double Trouble TFT');
  });

  it('shows the copyable room UUID after creating a room', async () => {
    vi.mocked(api.createRoom).mockResolvedValue({ roomId: 'room-uuid', participantToken: 'token' });

    render(<App />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Criar sala' })[0]);

    expect(await screen.findByRole('heading', { name: 'room-uuid' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar UUID' })).toBeInTheDocument();
  });
});
