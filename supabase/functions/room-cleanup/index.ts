import { errorResponse, json, options, serviceClient } from '../_shared/room-http.ts';

Deno.serve(async (request) => {
  const preflight = options(request);
  if (preflight) return preflight;
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const { data, error } = await serviceClient().rpc('room_cleanup', {
      p_now: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return json({ deleted: data });
  } catch (error) {
    return errorResponse(error);
  }
});
