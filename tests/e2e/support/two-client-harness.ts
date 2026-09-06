import { randomUUID } from 'node:crypto';

import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';

import { RoomService } from '../../../packages/server/src/room-service';

type Category = 'champions' | 'components';
type PriorityLists = Record<Category, string[]>;

type Participant = { lists: PriorityLists; online: boolean; token: string };
type Room = { participants: Participant[] };
type ClientRecord = { page: Page; roomId: string | null; token: string | null };

const emptyLists = (): PriorityLists => ({ champions: [], components: [] });
const copyLists = (lists: PriorityLists): PriorityLists => ({
  champions: [...lists.champions],
  components: [...lists.components],
});

export class TwoClientHarness {
  private now = Date.parse('2026-09-06T12:00:00Z');
  private readonly roomService = new RoomService({ now: () => new Date(this.now) });
  private readonly rooms = new Map<string, Room>();
  private readonly clients = new Map<string, ClientRecord>();
  private readonly browserContexts = new Set<BrowserContext>();

  constructor(private readonly browser: Browser) {}

  async newClient(): Promise<RoomClient> {
    const clientId = randomUUID();
    const context = await this.browser.newContext();
    this.browserContexts.add(context);
    const page = await context.newPage();
    this.clients.set(clientId, { page, roomId: null, token: null });

    await page.exposeFunction('__doubleTroubleSubscribe', async (roomId: string, token: string) => {
      this.requireParticipant(roomId, token);
      Object.assign(this.requireClient(clientId), { roomId, token });
      return this.partnerLists(roomId, token);
    });
    await page.exposeFunction(
      '__doubleTroubleUpdate',
      async (roomId: string, token: string, lists: PriorityLists) => {
        const participant = this.requireParticipant(roomId, token);
        participant.lists = copyLists(lists);
        await this.publishPartnerLists(roomId, token);
        return copyLists(participant.lists);
      },
    );
    await page.exposeFunction('__doubleTroubleUnsubscribe', () => undefined);
    await page.addInitScript(() => {
      type Lists = Record<'champions' | 'components', string[]>;
      const scope = window as typeof window & {
        __DOUBLE_TROUBLE_E2E_PUSH__?: (lists: Lists) => void;
        __DOUBLE_TROUBLE_E2E_TRANSPORT__?: {
          update(roomId: string, token: string, lists: Lists): Promise<Lists>;
          subscribe(
            roomId: string,
            token: string,
            onChange: (lists: Lists) => void,
            onConnectionChange: (state: string) => void,
          ): () => void;
        };
        __doubleTroubleSubscribe(roomId: string, token: string): Promise<Lists>;
        __doubleTroubleUnsubscribe(): Promise<void>;
        __doubleTroubleUpdate(roomId: string, token: string, lists: Lists): Promise<Lists>;
      };

      scope.__DOUBLE_TROUBLE_E2E_TRANSPORT__ = {
        update: (roomId, token, lists) => scope.__doubleTroubleUpdate(roomId, token, lists),
        subscribe: (roomId, token, onChange, onConnectionChange) => {
          scope.__DOUBLE_TROUBLE_E2E_PUSH__ = onChange;
          onConnectionChange('connected');
          void scope.__doubleTroubleSubscribe(roomId, token).then(onChange);
          return () => {
            delete scope.__DOUBLE_TROUBLE_E2E_PUSH__;
            void scope.__doubleTroubleUnsubscribe();
          };
        },
      };
    });

    await page.route('**/functions/v1/room-create', async (route) => {
      const response = await this.createRoom(clientId);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    });
    await page.route('**/functions/v1/room-join', async (route) => {
      try {
        const body = route.request().postDataJSON() as { roomId: string };
        const response = await this.joinRoom(clientId, body.roomId);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'room_request_failed';
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: message }) });
      }
    });
    await page.goto('/');

    return new RoomClient(this, clientId, context, page);
  }

  async disconnect(clientId: string): Promise<void> {
    const client = this.requireClient(clientId);
    if (client.roomId && client.token) {
      const participant = this.rooms.get(client.roomId)?.participants
        .find((candidate) => candidate.token === client.token);
      if (participant) participant.online = false;
      await this.roomService.leaveRoom(client.roomId, client.token);
    }
    this.clients.delete(clientId);
  }

  async advanceClock(milliseconds: number): Promise<void> {
    this.now += milliseconds;
    await this.roomService.cleanupExpiredRooms();
    for (const roomId of this.rooms.keys()) {
      if (await this.roomService.countParticipants(roomId) === 0) this.rooms.delete(roomId);
    }
  }

  async roomExists(roomId: string): Promise<boolean> {
    return (await this.roomService.countParticipants(roomId)) > 0;
  }

  async close(): Promise<void> {
    await Promise.allSettled([...this.browserContexts].map((context) => context.close()));
    this.browserContexts.clear();
    this.clients.clear();
  }

  private async createRoom(clientId: string): Promise<{ roomId: string; participantToken: string }> {
    const response = await this.roomService.createRoom();
    this.rooms.set(response.roomId, {
      participants: [{ lists: emptyLists(), online: true, token: response.participantToken }],
    });
    Object.assign(this.requireClient(clientId), { roomId: response.roomId, token: response.participantToken });
    return response;
  }

  private async joinRoom(clientId: string, roomId: string): Promise<{ roomId: string; participantToken: string }> {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('room_not_found');
    const response = await this.roomService.joinRoom(roomId);
    room.participants.push({ lists: emptyLists(), online: true, token: response.participantToken });
    Object.assign(this.requireClient(clientId), { roomId, token: response.participantToken });
    return response;
  }

  private requireClient(clientId: string): ClientRecord {
    const client = this.clients.get(clientId);
    if (!client) throw new Error('client_not_found');
    return client;
  }

  private requireParticipant(roomId: string, token: string): Participant {
    const participant = this.rooms.get(roomId)?.participants.find((candidate) => candidate.token === token);
    if (!participant) throw new Error('participant_not_found');
    return participant;
  }

  private partnerLists(roomId: string, ownToken: string): PriorityLists {
    const partner = this.rooms.get(roomId)?.participants.find((candidate) => candidate.token !== ownToken);
    return partner ? copyLists(partner.lists) : emptyLists();
  }

  private async publishPartnerLists(roomId: string, updatedToken: string): Promise<void> {
    const deliveries = [...this.clients.values()]
      .filter((client) => client.roomId === roomId && client.token && client.token !== updatedToken)
      .map(async (client) => {
        const lists = this.partnerLists(roomId, client.token!);
        await client.page.evaluate((nextLists) => {
          type Lists = Record<'champions' | 'components', string[]>;
          const scope = window as typeof window & { __DOUBLE_TROUBLE_E2E_PUSH__?: (value: Lists) => void };
          scope.__DOUBLE_TROUBLE_E2E_PUSH__?.(nextLists);
        }, lists);
      });
    await Promise.all(deliveries);
  }
}

export class RoomClient {
  private closed = false;

  constructor(
    private readonly harness: TwoClientHarness,
    private readonly clientId: string,
    private readonly context: BrowserContext,
    private readonly page: Page,
  ) {}

  async createRoom(): Promise<string> {
    await this.page.getByRole('button', { name: 'Criar sala' }).click();
    return (await this.page.locator('.room-code').textContent())!;
  }

  async joinRoom(roomId: string): Promise<void> {
    await this.page.getByRole('textbox', { name: 'UUID da sala' }).fill(roomId);
    await this.page.getByRole('button', { name: 'Entrar com UUID' }).click();
    await this.page.getByRole('button', { name: 'Expandir' }).waitFor();
  }

  async addChampion(name: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Expandir' }).click();
    await this.page.getByRole('combobox', { name: 'Buscar campeão' }).fill(name);
    await this.page.getByRole('option', { name, exact: true }).click();
  }

  partnerList(category: Category): Locator {
    return this.page.getByRole('list', { name: category === 'champions' ? 'Campeões' : 'Componentes' });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.harness.disconnect(this.clientId);
    await this.context.close();
  }
}

export async function createTwoClientHarness(browser: Browser): Promise<TwoClientHarness> {
  return new TwoClientHarness(browser);
}

export async function advanceServerClock(harness: TwoClientHarness, milliseconds: number): Promise<void> {
  await harness.advanceClock(milliseconds);
}
