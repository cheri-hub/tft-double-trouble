import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  InMemoryListPersistence,
  ListService,
  ListServiceError,
  type ListUpdate,
} from './list-service';

const roomId = '11111111-1111-4111-8111-111111111111';
const tokenA = 'participant-a';
const tokenB = 'participant-b';
const now = new Date('2026-09-06T12:00:00Z');

describe('ListService', () => {
  let persistence: InMemoryListPersistence;
  let service: ListService;

  beforeEach(async () => {
    persistence = await InMemoryListPersistence.create([
      { roomId, participantToken: tokenA, slot: 1 },
      { roomId, participantToken: tokenB, slot: 2 },
    ]);
    service = new ListService(persistence);
  });

  it('persists only the participant own list and returns the validated order', async () => {
    const lists = { champions: ['ahri'], components: ['bf-sword'] };

    await expect(service.updateOwnLists(roomId, tokenA, lists, now)).resolves.toEqual(lists);

    expect(await service.getListsForPartner(roomId, tokenB)).toEqual(lists);
    expect(await service.getListsForPartner(roomId, tokenA)).toEqual({ champions: [], components: [] });
  });

  it('rejects invalid lists before persistence', async () => {
    const update = vi.spyOn(persistence, 'updateParticipantLists');

    await expect(
      service.updateOwnLists(roomId, tokenA, { champions: ['bf-sword'], components: [] }, now),
    ).rejects.toEqual(new ListServiceError('wrong_category'));

    expect(update).not.toHaveBeenCalled();
  });

  it('requires a matching room participant token', async () => {
    await expect(
      service.updateOwnLists(roomId, 'unknown-token', { champions: [], components: [] }, now),
    ).rejects.toEqual(new ListServiceError('participant_not_found'));
  });

  it('publishes only after persistence succeeds', async () => {
    const order: string[] = [];
    const update = vi.spyOn(persistence, 'updateParticipantLists').mockImplementation(async () => {
      order.push('persist');
      throw new Error('database_offline');
    });
    const publish = vi.fn(async (_update: ListUpdate) => {
      order.push('publish');
    });
    service = new ListService(persistence, publish);

    await expect(
      service.updateOwnLists(roomId, tokenA, { champions: ['ahri'], components: [] }, now),
    ).rejects.toThrow('database_offline');

    expect(update).toHaveBeenCalledOnce();
    expect(publish).not.toHaveBeenCalled();
    expect(order).toEqual(['persist']);
  });
});
