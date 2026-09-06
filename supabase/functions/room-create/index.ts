import { errorResponse, json, options, participantCredential, serviceClient } from '../_shared/room-http.ts';

Deno.serve(async (request) => {
  const preflight = options(request);
  if (preflight) return preflight;
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const credential = await participantCredential();
    const { data, error } = await serviceClient().rpc('room_create', {
      p_token_hash: credential.tokenHash,
      p_now: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return json({ roomId: data, participantToken: credential.token }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
