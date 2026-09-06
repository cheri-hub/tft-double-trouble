import { expect, test } from '@playwright/test';

import {
  advanceServerClock,
  createTwoClientHarness,
} from './support/two-client-harness';

test('partner sees an ordered list and room expires after both disconnect', async ({ browser }) => {
  const harness = await createTwoClientHarness(browser);
  try {
    const playerA = await harness.newClient();
    const roomId = await playerA.createRoom();
    const playerB = await harness.newClient();
    await playerB.joinRoom(roomId);
    await playerA.addChampion('Ahri');
    await expect(playerB.partnerList('champions')).toContainText('1. Ahri');
    await playerA.close();
    await playerB.close();
    await advanceServerClock(harness, 15 * 60 * 1000);
    await expect(harness.roomExists(roomId)).resolves.toBe(false);
  } finally {
    await harness.close();
  }
});
