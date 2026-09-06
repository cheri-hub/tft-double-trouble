import { requireValidDate, systemClock, type Clock } from './clock';
import { createParticipantToken, hashParticipantToken } from './participant-token';

const ROOM_LIFETIME_MS = 15 * 60 * 1_000;
const STALE_HEARTBEAT_MS = 60 * 1_000;

export type RoomErrorCode =
  | 'room_not_found'
  | 'room_expired'
  | 'room_full'
  | 'participant_not_found';

export class RoomError extends Error {
  constructor(readonly code: RoomErrorCode) {
    super(code);
    this.name = 'RoomError';
  }
}

type ParticipantRecord = {
  tokenHash: string;
  slot: 1 | 2;
  lastSeenAt: Date;
  online: boolean;
};

type RoomRecord = {
  id: string;
  createdAt: Date;
  lastBothOfflineAt: Date | null;
  expiresAt: Date | null;
  participants: ParticipantRecord[];
};

export class RoomService {
  private readonly rooms = new Map<string, RoomRecord>();

  constructor(private readonly clock: Clock = systemClock) {}

  async createRoom(now: Date = this.clock.now()): Promise<{ roomId: string; participantToken: string }> {
    const timestamp = requireValidDate(now);
    const roomId = crypto.randomUUID();
    const participant = await this.newParticipant(1, timestamp);

    this.rooms.set(roomId, {
      id: roomId,
      createdAt: timestamp,
      lastBothOfflineAt: null,
      expiresAt: null,
      participants: [participant.record],
    });

    return { roomId, participantToken: participant.token };
  }

  async joinRoom(
    roomId: string,
    now: Date = this.clock.now(),
  ): Promise<{ roomId: string; participantToken: string }> {
    const timestamp = requireValidDate(now);
    const room = this.getActiveRoom(roomId, timestamp);
    if (room.participants.length >= 2) {
      throw new RoomError('room_full');
    }

    const participant = await this.newParticipant(2, timestamp);
    room.participants.push(participant.record);
    this.clearExpiry(room);

    return { roomId, participantToken: participant.token };
  }

  async leaveRoom(roomId: string, participantToken: string, now: Date = this.clock.now()): Promise<void> {
    const timestamp = requireValidDate(now);
    const room = this.getActiveRoom(roomId, timestamp);
    const participant = await this.getParticipant(room, participantToken);
    participant.online = false;
    participant.lastSeenAt = timestamp;

    if (room.participants.every((candidate) => !candidate.online) && room.lastBothOfflineAt === null) {
      room.lastBothOfflineAt = timestamp;
      room.expiresAt = new Date(timestamp.getTime() + ROOM_LIFETIME_MS);
    }
  }

  async heartbeat(roomId: string, participantToken: string, now: Date = this.clock.now()): Promise<void> {
    const timestamp = requireValidDate(now);
    const room = this.getActiveRoom(roomId, timestamp);
    const participant = await this.getParticipant(room, participantToken);
    participant.online = true;
    participant.lastSeenAt = timestamp;
    this.clearExpiry(room);
  }

  async cleanupExpiredRooms(now: Date = this.clock.now()): Promise<number> {
    const timestamp = requireValidDate(now);
    let deleted = 0;

    for (const [roomId, room] of this.rooms) {
      for (const participant of room.participants) {
        if (participant.online && timestamp.getTime() - participant.lastSeenAt.getTime() >= STALE_HEARTBEAT_MS) {
          participant.online = false;
        }
      }
      if (room.participants.length > 0 && room.participants.every((participant) => !participant.online)) {
        room.lastBothOfflineAt ??= timestamp;
        room.expiresAt ??= new Date(timestamp.getTime() + ROOM_LIFETIME_MS);
      }
      if (room.expiresAt && room.expiresAt.getTime() <= timestamp.getTime()) {
        this.rooms.delete(roomId);
        deleted += 1;
      }
    }

    return deleted;
  }

  async countParticipants(roomId: string): Promise<number> {
    return this.rooms.get(roomId)?.participants.length ?? 0;
  }

  private async newParticipant(
    slot: 1 | 2,
    timestamp: Date,
  ): Promise<{ record: ParticipantRecord; token: string }> {
    const token = createParticipantToken();
    return {
      token,
      record: {
        tokenHash: await hashParticipantToken(token),
        slot,
        lastSeenAt: timestamp,
        online: true,
      },
    };
  }

  private getActiveRoom(roomId: string, now: Date): RoomRecord {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new RoomError('room_not_found');
    }

    if (room.expiresAt && room.expiresAt.getTime() <= now.getTime()) {
      throw new RoomError('room_expired');
    }

    return room;
  }

  private async getParticipant(room: RoomRecord, token: string): Promise<ParticipantRecord> {
    const tokenHash = await hashParticipantToken(token);
    const participant = room.participants.find((candidate) => candidate.tokenHash === tokenHash);
    if (!participant) {
      throw new RoomError('participant_not_found');
    }

    return participant;
  }

  private clearExpiry(room: RoomRecord): void {
    room.lastBothOfflineAt = null;
    room.expiresAt = null;
  }
}
