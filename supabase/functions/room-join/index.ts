import { errorResponse, json, objectBody, options, participantCredential, serviceClient } from '../_shared/room-http.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleRequest(request: Request): Promise<Response> {
  const preflight = options(request);
  if (preflight) return preflight;
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = await objectBody(request);
    if (typeof body.roomId !== 'string' || !UUID_PATTERN.test(body.roomId)) {
      return json({ error: 'invalid_room_id' }, 400);
    }
    const credential = await participantCredential();
    const { error } = await serviceClient().rpc('room_join', {
      p_room_id: body.roomId,
      p_token_hash: credential.tokenHash,
      p_now: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return json({ roomId: body.roomId, participantToken: credential.token });
  } catch (error) {
    return errorResponse(error);
  }
}

if (import.meta.main) {
  Deno.serve(handleRequest);
}
