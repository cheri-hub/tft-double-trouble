const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function functionsUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('room_transport_not_configured');
  return `${url.replace(/\/$/, '')}/functions/v1`;
}

async function request(path: string, body?: unknown): Promise<{ roomId: string; participantToken: string }> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('room_transport_not_configured');

  const response = await fetch(`${functionsUrl()}/${path}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload: unknown = await response.json();
  if (!response.ok) {
    throw normalizeError(payload);
  }

  if (!isRoomResponse(payload)) throw new Error('invalid_room_response');
  return payload;
}

export async function createRoom(): Promise<{ roomId: string; participantToken: string }> {
  return request('room-create');
}

export async function joinRoom(_roomId: string): Promise<{ roomId: string; participantToken: string }> {
  if (!UUID_PATTERN.test(_roomId)) {
    throw new Error('invalid_room_id');
  }

  return request('room-join', { roomId: _roomId });
}

function isRoomResponse(value: unknown): value is { roomId: string; participantToken: string } {
  return Boolean(
    value
    && typeof value === 'object'
    && 'roomId' in value
    && 'participantToken' in value
    && typeof value.roomId === 'string'
    && typeof value.participantToken === 'string',
  );
}

function normalizeError(value: unknown): Error {
  if (value && typeof value === 'object' && 'error' in value && typeof value.error === 'string') {
    const error = new Error(value.error);
    return error;
  }

  return new Error('room_request_failed');
}
