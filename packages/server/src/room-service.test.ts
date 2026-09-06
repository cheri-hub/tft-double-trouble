import { beforeEach, describe, expect, it } from 'vitest';

import { RoomError, RoomService } from './room-service';

const at = (value: string): Date => new Date(value);

describe('RoomService', () => {
  let service: RoomService;

  beforeEach(() => {
    service = new RoomService();
  });

  it('creates one room with one participant and a UUID room id', async () => {
    const result = await service.createRoom(at('2026-09-06T12:00:00Z'));

    expect(result.roomId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(result.participantToken).not.toBe('');
    expect(await service.countParticipants(result.roomId)).toBe(1);
  });

  it('rejects joining a missing room', async () => {
    await expect(
      service.joinRoom('11111111-1111-4111-8111-111111111111', at('2026-09-06T12:00:00Z')),
    ).rejects.toEqual(new RoomError('room_not_found'));
  });

  it('rejects a third participant', async () => {
    const room = await service.createRoom(at('2026-09-06T12:00:00Z'));
    await service.joinRoom(room.roomId, at('2026-09-06T12:01:00Z'));

    await expect(service.joinRoom(room.roomId, at('2026-09-06T12:02:00Z'))).rejects.toEqual(
      new RoomError('room_full'),
    );
  });

  it('expires a room fifteen minutes after both participants leave', async () => {
    const first = await service.createRoom(at('2026-09-06T12:00:00Z'));
    const second = await service.joinRoom(first.roomId, at('2026-09-06T12:01:00Z'));
    await service.leaveRoom(first.roomId, first.participantToken, at('2026-09-06T12:02:00Z'));
    await service.leaveRoom(first.roomId, second.participantToken, at('2026-09-06T12:02:00Z'));

    expect(await service.cleanupExpiredRooms(at('2026-09-06T12:16:59Z'))).toBe(0);
    expect(await service.cleanupExpiredRooms(at('2026-09-06T12:17:00Z'))).toBe(1);
    await expect(service.joinRoom(first.roomId, at('2026-09-06T12:17:00Z'))).rejects.toEqual(
      new RoomError('room_not_found'),
    );
  });

  it('rejects joining a room whose expiry deadline has passed before cleanup', async () => {
    const room = await service.createRoom(at('2026-09-06T12:00:00Z'));
    await service.leaveRoom(room.roomId, room.participantToken, at('2026-09-06T12:01:00Z'));

    await expect(service.joinRoom(room.roomId, at('2026-09-06T12:16:00Z'))).rejects.toEqual(
      new RoomError('room_expired'),
    );
  });

  it('requires the participant token to leave or heartbeat', async () => {
    const room = await service.createRoom(at('2026-09-06T12:00:00Z'));

    await expect(service.leaveRoom(room.roomId, 'not-the-token', at('2026-09-06T12:01:00Z'))).rejects.toEqual(
      new RoomError('participant_not_found'),
    );
    await expect(service.heartbeat(room.roomId, 'not-the-token', at('2026-09-06T12:01:00Z'))).rejects.toEqual(
      new RoomError('participant_not_found'),
    );
  });

  it('cancels room expiry when a participant reconnects before the deadline', async () => {
    const first = await service.createRoom(at('2026-09-06T12:00:00Z'));
    const second = await service.joinRoom(first.roomId, at('2026-09-06T12:01:00Z'));
    await service.leaveRoom(first.roomId, first.participantToken, at('2026-09-06T12:02:00Z'));
    await service.leaveRoom(first.roomId, second.participantToken, at('2026-09-06T12:02:00Z'));

    await service.heartbeat(first.roomId, first.participantToken, at('2026-09-06T12:16:59Z'));

    expect(await service.cleanupExpiredRooms(at('2026-09-06T12:17:00Z'))).toBe(0);
    expect(await service.countParticipants(first.roomId)).toBe(2);
  });

  it('does not extend the expiry deadline when an offline participant leaves again', async () => {
    const room = await service.createRoom(at('2026-09-06T12:00:00Z'));
    await service.leaveRoom(room.roomId, room.participantToken, at('2026-09-06T12:01:00Z'));

    await service.leaveRoom(room.roomId, room.participantToken, at('2026-09-06T12:10:00Z'));

    expect(await service.cleanupExpiredRooms(at('2026-09-06T12:16:00Z'))).toBe(1);
  });

  it('marks crashed participants offline and starts expiry after stale heartbeats', async () => {
    const first = await service.createRoom(at('2026-09-06T12:00:00Z'));
    await service.joinRoom(first.roomId, at('2026-09-06T12:00:20Z'));

    expect(await service.cleanupExpiredRooms(at('2026-09-06T12:01:20Z'))).toBe(0);
    expect(await service.cleanupExpiredRooms(at('2026-09-06T12:16:19Z'))).toBe(0);
    expect(await service.cleanupExpiredRooms(at('2026-09-06T12:16:20Z'))).toBe(1);
  });

  it('keeps a room alive while one participant continues heartbeating', async () => {
    const first = await service.createRoom(at('2026-09-06T12:00:00Z'));
    await service.joinRoom(first.roomId, at('2026-09-06T12:00:00Z'));
    await service.heartbeat(first.roomId, first.participantToken, at('2026-09-06T12:01:10Z'));

    expect(await service.cleanupExpiredRooms(at('2026-09-06T12:01:20Z'))).toBe(0);
    expect(await service.cleanupExpiredRooms(at('2026-09-06T12:16:20Z'))).toBe(0);
  });
});
