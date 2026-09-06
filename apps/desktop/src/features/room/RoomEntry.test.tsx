import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoomEntry } from './RoomEntry';
import * as api from './room-api';

vi.mock('./room-api', () => ({
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('RoomEntry', () => {
  it('offers create and join actions', () => {
    render(<RoomEntry onConnected={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Criar sala' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar com UUID' })).toBeInTheDocument();
  });

  it('shows a copyable UUID after creating a room', async () => {
    vi.mocked(api.createRoom).mockResolvedValue({ roomId: 'room-uuid', participantToken: 'token' });

    render(<RoomEntry onConnected={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));

    expect(await screen.findByRole('button', { name: 'Criar sala' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar UUID' })).not.toBeInTheDocument();
  });

  it('shows a translated error when joining a missing room', async () => {
    vi.mocked(api.joinRoom).mockRejectedValue({ code: 'room_not_found' });

    render(<RoomEntry onConnected={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('UUID da sala'), { target: { value: 'room-uuid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar com UUID' }));

    expect(await screen.findByText('Sala não encontrada.')).toBeInTheDocument();
  });
});
