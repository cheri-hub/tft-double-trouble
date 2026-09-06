import { assertEquals } from 'jsr:@std/assert@1';

import { handleRequest } from './index.ts';

Deno.test('rejects a non-UUID room id before accessing Postgres', async () => {
  const response = await handleRequest(
    new Request('http://localhost/room-join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomId: 'not-a-uuid' }),
    }),
  );

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: 'invalid_room_id' });
});
