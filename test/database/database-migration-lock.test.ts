import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';

import { AdvisoryLockKeyUtil } from '../../src/database/advisory-lock-key.util';

const PGVECTOR_IMAGE = 'pgvector/pgvector:pg16';
const LOCK_KEY = AdvisoryLockKeyUtil.fromName('ai-incident-response-copilot:database-migrations');

describe('Postgres advisory lock for migrations IT', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(PGVECTOR_IMAGE).withReuse().start();
    pool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      user: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
    });
  }, 60_000);

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  describe('Given two replicas racing to acquire the same migration lock key', () => {
    describe('When both request the lock concurrently', () => {
      test('Then they never hold it at the same time — whichever loses the race only acquires after the winner releases', async () => {
        const events: string[] = [];

        const replica = (name: string) => async (): Promise<void> => {
          const client = await pool.connect();
          try {
            await client.query('SELECT pg_advisory_lock($1, $2)', LOCK_KEY);
            events.push(`${name} acquired`);
            await new Promise((resolve) => setTimeout(resolve, 300));
            events.push(`${name} releasing`);
            await client.query('SELECT pg_advisory_unlock($1, $2)', LOCK_KEY);
          } finally {
            client.release();
          }
        };

        await Promise.all([replica('A')(), replica('B')()]);

        const winner = events[0]!.split(' ')[0];
        const loser = winner === 'A' ? 'B' : 'A';

        expect(events).toEqual([
          `${winner} acquired`,
          `${winner} releasing`,
          `${loser} acquired`,
          `${loser} releasing`,
        ]);
      });
    });
  });
});
