import { randomUUID } from 'node:crypto';

import { IncidentLogsRepository } from '../../src/incidents/incident-logs.repository';
import type { IncidentLogInsert } from '../../src/schema/incident-logs.schema';
import { incidentLogsTable } from '../../src/schema/incident-logs.schema';
import { incidentsTable } from '../../src/schema/incidents.schema';
import { mockIncidentInsert } from '../__mocks__/incident.mock';
import { mockIncidentLogInsert } from '../__mocks__/incident-log.mock';
import { DrizzleTestEnvironment } from '../helpers/drizzle-test-environment';

describe('IncidentLogsRepository IT', () => {
  const env = new DrizzleTestEnvironment();
  let sut: IncidentLogsRepository;
  let incidentId: ReturnType<typeof randomUUID>;

  beforeAll(async () => {
    await env.start([IncidentLogsRepository]);
    sut = env.module.get(IncidentLogsRepository);
  }, 60_000);

  afterAll(() => env.stop());

  beforeEach(async () => {
    const [incident] = await env.db.insert(incidentsTable).values(mockIncidentInsert()).returning();
    incidentId = incident!.id;
  });

  afterEach(async () => {
    await env.db.delete(incidentLogsTable);
    await env.db.delete(incidentsTable);
  });

  const seed = (overrides: Partial<IncidentLogInsert> = {}) =>
    env.db
      .insert(incidentLogsTable)
      .values(mockIncidentLogInsert({ incidentId, ...overrides }))
      .returning()
      .then(([row]) => row!);

  describe('Given search', () => {
    describe('When only incidentId is provided', () => {
      test("Then it returns that incident's logs ordered oldest-first, excluding other incidents' logs", async () => {
        const first = await seed({ timestamp: new Date('2026-08-12T14:00:00Z'), message: 'first' });
        const second = await seed({ timestamp: new Date('2026-08-12T14:05:00Z'), message: 'second' });

        const [otherIncident] = await env.db.insert(incidentsTable).values(mockIncidentInsert()).returning();
        await env.db
          .insert(incidentLogsTable)
          .values(mockIncidentLogInsert({ incidentId: otherIncident!.id, message: 'unrelated' }));

        const results = await sut.search({ incidentId });

        expect(results).toEqual([first, second]);
      });
    });

    describe('When a query string is provided', () => {
      test('Then it returns only logs whose message matches it, case-insensitively', async () => {
        const match = await seed({ message: 'pod payments-api OOMKilled (exit code 137)' });
        await seed({ message: 'deployment rollout complete' });

        const results = await sut.search({ incidentId, query: 'oomkilled' });

        expect(results).toEqual([match]);
      });
    });

    describe('When a level is provided', () => {
      test('Then it returns only logs at that level', async () => {
        const fatal = await seed({ level: 'FATAL', message: 'OOMKilled' });
        await seed({ level: 'INFO', message: 'rollout started' });

        const results = await sut.search({ incidentId, level: 'FATAL' });

        expect(results).toEqual([fatal]);
      });
    });

    describe('When a limit is provided', () => {
      test('Then it returns at most that many logs, oldest first', async () => {
        const first = await seed({ timestamp: new Date('2026-08-12T14:00:00Z') });
        await seed({ timestamp: new Date('2026-08-12T14:05:00Z') });

        const results = await sut.search({ incidentId, limit: 1 });

        expect(results).toEqual([first]);
      });
    });

    describe('When no logs match', () => {
      test('Then it returns an empty array', async () => {
        const results = await sut.search({ incidentId, query: 'no such thing' });

        expect(results).toEqual([]);
      });
    });
  });
});
