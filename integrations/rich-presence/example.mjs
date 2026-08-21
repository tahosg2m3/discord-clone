import { RichPresenceClient } from './javascript-client.mjs';

const presence = new RichPresenceClient({
  token: process.env.TAHOS_PRESENCE_TOKEN,
});

await presence.setActivity({
  sessionId: 'my-game',
  type: 'playing',
  name: 'Crystal Frontier',
  details: 'Level 24 — Frozen Citadel',
  state: 'Ranked match • Blue team',
  startedAt: Date.now(),
  imageUrl: 'https://example.com/crystal-frontier.png',
  progress: { current: 24, total: 50, label: 'Level progress' },
  party: { id: 'ranked-party', size: 3, max: 5 },
  metadata: { Score: '12,450', Region: 'EU' },
  buttons: [{ label: 'Game website', url: 'https://example.com' }],
});

process.once('SIGINT', async () => {
  await presence.clear().catch(() => {});
  process.exit(0);
});
