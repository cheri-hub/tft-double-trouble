import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('API_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('ANON_KEY');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
const configured = Boolean(url && anonKey && serviceKey);
const supabaseUrl = url ?? '';
const supabaseAnonKey = anonKey ?? '';
const supabaseServiceKey = serviceKey ?? '';

Deno.test({
  name: 'create/join/update/broadcast/heartbeat/leave/stale cleanup contract',
  ignore: !configured,
  async fn() {
  let roomId = '';
  const admin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  const realtime = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  try {
    const first = await call('room-create', {});
    roomId = String(first.roomId);
    const second = await call('room-join', { roomId });
    const full = await callRaw('room-join', { roomId });
    equal(full.status, 409, 'third participant must be rejected');

    const broadcast = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('list_changed broadcast timed out')), 5_000);
      realtime.channel(`room:${roomId}`)
        .on('broadcast', { event: 'list_changed' }, () => { clearTimeout(timeout); resolve(); })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await call('list-update', {
              action: 'update', roomId, participantToken: first.participantToken,
              lists: { champions: ['ahri', 'elder-dragon'], components: ['bf-sword'] },
            });
          }
        });
    });
    await broadcast;

    const projection = await call('list-update', {
      action: 'get_partner', roomId, participantToken: second.participantToken,
    });
    equal(JSON.stringify(projection.lists), JSON.stringify({ champions: ['ahri', 'elder-dragon'], components: ['bf-sword'] }), 'partner projection');

    await call('room-leave', { roomId, participantToken: first.participantToken });
    const offline = await call('list-update', { action: 'get_partner', roomId, participantToken: second.participantToken });
    equal(offline.partnerPresence, 'offline', 'explicit leave presence');
    await call('room-heartbeat', { roomId, participantToken: first.participantToken });

    const staleAt = new Date(Date.now() - 120_000).toISOString();
    const { error: staleError } = await admin.from('participants').update({ online: true, last_seen_at: staleAt }).eq('room_id', roomId);
    if (staleError) throw staleError;
    const sweepAt = new Date();
    const { error: sweepError } = await admin.rpc('room_cleanup', { p_now: sweepAt.toISOString() });
    if (sweepError) throw sweepError;
    const { error: deleteError } = await admin.rpc('room_cleanup', { p_now: new Date(sweepAt.getTime() + 15 * 60_000).toISOString() });
    if (deleteError) throw deleteError;
    const { data } = await admin.from('rooms').select('id').eq('id', roomId).maybeSingle();
    equal(data, null, 'stale room must be deleted after deadline');
    roomId = '';
  } finally {
    await realtime.removeAllChannels();
    if (roomId) await admin.from('rooms').delete().eq('id', roomId);
  }
  },
});

async function call(path: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await callRaw(path, body);
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

function callRaw(path: string, body: unknown) {
  return fetch(`${supabaseUrl}/functions/v1/${path}`, {
    method: 'POST',
    headers: { apikey: supabaseAnonKey, authorization: `Bearer ${supabaseAnonKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function equal(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}
