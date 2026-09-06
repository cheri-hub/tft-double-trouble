import { CATALOG, validatePriorityLists, type PriorityLists, type ValidationError } from '../../domain/src';

import { requireValidDate } from './clock';
import { hashParticipantToken } from './participant-token';

const emptyLists = (): PriorityLists => ({ champions: [], components: [] });

export type ListServiceErrorCode = ValidationError['code'] | 'participant_not_found';

export class ListServiceError extends Error {
  constructor(readonly code: ListServiceErrorCode) {
    super(code);
    this.name = 'ListServiceError';
  }
}

export type ParticipantListRecord = {
  roomId: string;
  tokenHash: string;
  slot: 1 | 2;
  lists: PriorityLists;
  updatedAt: Date | null;
};

export type ListUpdate = {
  roomId: string;
  slot: 1 | 2;
  lists: PriorityLists;
  updatedAt: Date;
};

export interface ListPersistence {
  findParticipant(roomId: string, tokenHash: string): Promise<ParticipantListRecord | null>;
  findPartner(roomId: string, slot: 1 | 2): Promise<ParticipantListRecord | null>;
  updateParticipantLists(roomId: string, slot: 1 | 2, lists: PriorityLists, updatedAt: Date): Promise<void>;
}

export type PublishListUpdate = (update: ListUpdate) => Promise<void>;

export class ListService {
  constructor(
    private readonly persistence: ListPersistence,
    private readonly publish: PublishListUpdate = async () => undefined,
  ) {}

  async updateOwnLists(
    roomId: string,
    participantToken: string,
    lists: PriorityLists,
    now: Date,
  ): Promise<PriorityLists> {
    const timestamp = requireValidDate(now);
    const validation = validatePriorityLists(lists, CATALOG);
    if (!validation.ok) throw new ListServiceError(validation.code);

    const participant = await this.findParticipant(roomId, participantToken);
    const confirmed = copyLists(validation.value);
    await this.persistence.updateParticipantLists(roomId, participant.slot, confirmed, timestamp);
    await this.publish({ roomId, slot: participant.slot, lists: copyLists(confirmed), updatedAt: timestamp });
    return copyLists(confirmed);
  }

  async getListsForPartner(roomId: string, participantToken: string): Promise<PriorityLists> {
    const participant = await this.findParticipant(roomId, participantToken);
    const partner = await this.persistence.findPartner(roomId, participant.slot);
    return partner ? copyLists(partner.lists) : emptyLists();
  }

  private async findParticipant(roomId: string, token: string): Promise<ParticipantListRecord> {
    const participant = await this.persistence.findParticipant(roomId, await hashParticipantToken(token));
    if (!participant) throw new ListServiceError('participant_not_found');
    return participant;
  }
}

export type InMemoryParticipantSeed = {
  roomId: string;
  participantToken: string;
  slot: 1 | 2;
  lists?: PriorityLists;
};

export class InMemoryListPersistence implements ListPersistence {
  private constructor(private readonly records: ParticipantListRecord[]) {}

  static async create(seeds: InMemoryParticipantSeed[]): Promise<InMemoryListPersistence> {
    return new InMemoryListPersistence(await Promise.all(seeds.map(async (seed) => ({
      roomId: seed.roomId,
      tokenHash: await hashParticipantToken(seed.participantToken),
      slot: seed.slot,
      lists: copyLists(seed.lists ?? emptyLists()),
      updatedAt: null,
    }))));
  }

  async findParticipant(roomId: string, tokenHash: string): Promise<ParticipantListRecord | null> {
    return this.copy(this.records.find((record) => record.roomId === roomId && record.tokenHash === tokenHash));
  }

  async findPartner(roomId: string, slot: 1 | 2): Promise<ParticipantListRecord | null> {
    return this.copy(this.records.find((record) => record.roomId === roomId && record.slot !== slot));
  }

  async updateParticipantLists(
    roomId: string,
    slot: 1 | 2,
    lists: PriorityLists,
    updatedAt: Date,
  ): Promise<void> {
    const record = this.records.find((candidate) => candidate.roomId === roomId && candidate.slot === slot);
    if (!record) throw new ListServiceError('participant_not_found');
    record.lists = copyLists(lists);
    record.updatedAt = new Date(updatedAt);
  }

  private copy(record: ParticipantListRecord | undefined): ParticipantListRecord | null {
    return record ? { ...record, lists: copyLists(record.lists), updatedAt: record.updatedAt && new Date(record.updatedAt) } : null;
  }
}

function copyLists(lists: PriorityLists): PriorityLists {
  return { champions: [...lists.champions], components: [...lists.components] };
}
