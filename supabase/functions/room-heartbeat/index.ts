import { errorResponse, json, objectBody, options, serviceClient, tokenHash } from '../_shared/room-http.ts';

Deno.serve(async (request) => {
  const preflight = options(request);
  if (preflight) return preflight;
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = await objectBody(request);
    if (typeof body.roomId !== 'string' || typeof body.participantToken !== 'string') {
      return json({ error: 'invalid_credentials' }, 400);
    }
    const { error } = await serviceClient().rpc('room_heartbeat', {
      p_room_id: body.roomId,
      p_token_hash: await tokenHash(body.participantToken),
      p_now: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
});
