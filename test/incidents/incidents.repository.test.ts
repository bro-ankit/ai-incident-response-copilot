import { randomUUID } from 'node:crypto';

import { IncidentsRepository } from '../../src/incidents/incidents.repository';
import type { IncidentInsert } from '../../src/schema/incidents.schema';
import { incidentsTable } from '../../src/schema/incidents.schema';
import { mockIncidentInsert } from '../__mocks__/incident.mock';
import { DrizzleTestEnvironment } from '../helpers/drizzle-test-environment';

describe('IncidentsRepository IT', () => {
  const env = new DrizzleTestEnvironment();
  let sut: IncidentsRepository;

  beforeAll(async () => {
    await env.start([IncidentsRepository]);
    sut = env.module.get(IncidentsRepository);
  }, 60_000);

  afterAll(() => env.stop());

  afterEach(async () => {
    await env.db.delete(incidentsTable);
  });

  const seed = async (overrides: Partial<IncidentInsert> = {}) => {
    const [result] = await env.db.insert(incidentsTable).values(mockIncidentInsert(overrides)).returning();
    return result;
  };

  describe('Given findAll', () => {
    describe('When multiple incidents exist', () => {
      test('Then it returns all of them ordered by occurredAt, most recent first', async () => {
        const older = await seed({ title: 'older incident', occurredAt: new Date('2026-08-01T00:00:00Z') });
        const newer = await seed({ title: 'newer incident', occurredAt: new Date('2026-08-10T00:00:00Z') });

        const results = await sut.findAll();

        expect(results).toEqual([newer, older]);
      });
    });

    describe('When no incidents exist', () => {
      test('Then it returns an empty array', async () => {
        const results = await sut.findAll();

        expect(results).toEqual([]);
      });
    });
  });

  describe('Given findById', () => {
    describe('When an incident with that id exists', () => {
      test('Then it returns that incident', async () => {
        const incident = await seed();
        await seed({ title: 'a different incident' });

        const result = await sut.findById(incident.id);

        expect(result).toEqual(incident);
      });
    });

    describe('When no incident with that id exists', () => {
      test('Then it returns undefined', async () => {
        const result = await sut.findById(randomUUID());

        expect(result).toBeUndefined();
      });
    });
  });

  describe('Given findGoldenSet', () => {
    describe('When some incidents are golden cases and some are not', () => {
      test('Then it returns only the golden ones, ordered by occurredAt, most recent first', async () => {
        const golden = await seed({
          title: 'golden incident',
          isGoldenCase: true,
          occurredAt: new Date('2026-08-10T00:00:00Z'),
        });
        await seed({ title: 'non-golden incident', isGoldenCase: false });

        const results = await sut.findGoldenSet();

        expect(results).toEqual([golden]);
      });
    });

    describe('When no incidents are golden cases', () => {
      test('Then it returns an empty array', async () => {
        await seed({ isGoldenCase: false });

        const results = await sut.findGoldenSet();

        expect(results).toEqual([]);
      });
    });
  });
});
