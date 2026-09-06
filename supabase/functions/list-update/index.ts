import { validatePriorityLists, type PriorityLists } from '../_shared/list-validation.ts';

import { errorResponse, json, objectBody, options, serviceClient, tokenHash } from '../_shared/room-http.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emptyLists = (): PriorityLists => ({ champions: [], components: [] });

export async function handleRequest(request: Request): Promise<Response> {
  const preflight = options(request);
  if (preflight) return preflight;
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = await objectBody(request);
    if (typeof body.roomId !== 'string' || !UUID_PATTERN.test(body.roomId)) {
      return json({ error: 'invalid_room_id' }, 400);
    }
    if (typeof body.participantToken !== 'string' || body.participantToken.length === 0) {
      return json({ error: 'participant_not_found' }, 401);
    }

    const client = serviceClient();
    const participant = await findParticipant(client, body.roomId, await tokenHash(body.participantToken));
    if (!participant) return json({ error: 'participant_not_found' }, 401);

    if (body.action === 'get_partner') {
      const { data, error } = await client
        .from('participants')
        .select('champion_list,component_list,online')
        .eq('room_id', body.roomId)
        .neq('slot', participant.slot)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return json({
        lists: data ? listsFromRow(data) : emptyLists(),
        partnerPresence: data ? (data.online ? 'online' : 'offline') : 'waiting',
      });
    }

    if (body.action !== 'update' || !isPriorityLists(body.lists)) {
      return json({ error: 'invalid_lists' }, 400);
    }
    const validation = validatePriorityLists(body.lists);
    if (!validation.ok) return json({ error: validation.code, index: validation.index }, 400);

    const confirmed = validation.value;
    const { error } = await client
      .from('participants')
      .update({
        champion_list: confirmed.champions,
        component_list: confirmed.components,
        lists_updated_at: new Date().toISOString(),
      })
      .eq('room_id', body.roomId)
      .eq('slot', participant.slot);
    if (error) throw new Error(error.message);

    const channel = client.channel(`room:${body.roomId}`);
    await channel.send({ type: 'broadcast', event: 'list_changed', payload: { slot: participant.slot } });
    await client.removeChannel(channel);
    return json({ lists: confirmed });
  } catch (error) {
    return errorResponse(error);
  }
}

if (import.meta.main) Deno.serve(handleRequest);

type ParticipantRow = { slot: 1 | 2 };
type ListRow = { champion_list: unknown; component_list: unknown; online: boolean };
type QueryClient = ReturnType<typeof serviceClient>;

async function findParticipant(client: QueryClient, roomId: string, participantTokenHash: string): Promise<ParticipantRow | null> {
  const { data, error } = await client
    .from('participants')
    .select('slot')
    .eq('room_id', roomId)
    .eq('token_hash', participantTokenHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ParticipantRow | null;
}

function isPriorityLists(value: unknown): value is PriorityLists {
  return Boolean(
    value && typeof value === 'object'
      && 'champions' in value && Array.isArray(value.champions) && value.champions.every((id) => typeof id === 'string')
      && 'components' in value && Array.isArray(value.components) && value.components.every((id) => typeof id === 'string'),
  );
}

function listsFromRow(row: ListRow): PriorityLists {
  if (!Array.isArray(row.champion_list) || !row.champion_list.every((id) => typeof id === 'string')) {
    throw new Error('invalid_persisted_lists');
  }
  if (!Array.isArray(row.component_list) || !row.component_list.every((id) => typeof id === 'string')) {
    throw new Error('invalid_persisted_lists');
  }
  return { champions: row.champion_list, components: row.component_list };
}
