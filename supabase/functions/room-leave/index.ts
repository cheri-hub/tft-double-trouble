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
    const client = serviceClient();
    const { error } = await client.rpc('room_leave', {
      p_room_id: body.roomId,
      p_token_hash: await tokenHash(body.participantToken),
      p_now: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    const channel = client.channel(`room:${body.roomId}`);
    try {
      await channel.send({ type: 'broadcast', event: 'presence_changed', payload: {} });
    } catch {
      // Presence updates are advisory; leave success should not depend on broadcast delivery.
    } finally {
      await client.removeChannel(channel).catch(() => undefined);
    }
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
});
