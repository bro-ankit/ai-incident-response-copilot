import { GraphRepository } from '../../src/graph/graph.repository';
import { GraphTestEnvironment } from '../helpers/graph-test-environment';

describe('GraphRepository IT', () => {
  const env = new GraphTestEnvironment();
  let sut: GraphRepository;

  beforeAll(async () => await env.start([GraphRepository]), 60_000);
  afterAll(async () => await env.stop());
  afterEach(async () => await env.clear());

  beforeAll(() => {
    sut = env.module.get(GraphRepository);
  });

  describe('Given upsertDependency', () => {
    describe('When called twice with the same service, dependency, and criticality', () => {
      test('Then it creates exactly one node pair and one edge, not duplicates', async () => {
        await sut.upsertDependency('checkout-service', 'payments-api', 'hard');
        await sut.upsertDependency('checkout-service', 'payments-api', 'hard');

        const result = await sut.blastRadius('payments-api');

        expect(result).toEqual([{ name: 'checkout-service', criticality: 'hard' }]);
      });
    });

    describe('When called again for the same edge with a different criticality', () => {
      test('Then it updates the criticality on the existing edge rather than creating a second one', async () => {
        await sut.upsertDependency('checkout-service', 'payments-api', 'hard');
        await sut.upsertDependency('checkout-service', 'payments-api', 'soft');

        const result = await sut.blastRadius('payments-api');

        expect(result).toEqual([{ name: 'checkout-service', criticality: 'soft' }]);
      });
    });
  });

  describe('Given blastRadius', () => {
    describe('When a service has direct and transitive dependents, all via hard edges', () => {
      test('Then it returns every dependent up to 3 hops away, each marked hard', async () => {
        await sut.upsertDependency('checkout-service', 'payments-api', 'hard');
        await sut.upsertDependency('payments-api', 'postgres', 'hard');
        await sut.upsertDependency('refunds-service', 'payments-api', 'hard');
        await sut.upsertDependency('webhook-processor', 'kafka', 'hard');

        const result = await sut.blastRadius('payments-api');

        expect([...result].sort((a, b) => a.name.localeCompare(b.name))).toEqual([
          { name: 'checkout-service', criticality: 'hard' },
          { name: 'refunds-service', criticality: 'hard' },
        ]);
      });
    });

    describe('When the only path to the affected service is entirely soft edges', () => {
      test('Then that service is reported with criticality "soft"', async () => {
        await sut.upsertDependency('pricing-service', 'redis', 'soft');

        const result = await sut.blastRadius('redis');

        expect(result).toEqual([{ name: 'pricing-service', criticality: 'soft' }]);
      });
    });

    describe('When a service has two paths to the same affected service and at least one is fully hard', () => {
      test('Then that service is reported as "hard", even though a softer path also exists', async () => {
        // checkout-service -> pricing-service -> redis (soft) AND checkout-service -> payments-api -> redis (hard, contrived)
        await sut.upsertDependency('checkout-service', 'pricing-service', 'soft');
        await sut.upsertDependency('pricing-service', 'redis', 'soft');
        await sut.upsertDependency('checkout-service', 'payments-api', 'hard');
        await sut.upsertDependency('payments-api', 'redis', 'hard');

        const result = await sut.blastRadius('redis');

        expect([...result].sort((a, b) => a.name.localeCompare(b.name))).toEqual([
          { name: 'checkout-service', criticality: 'hard' },
          { name: 'payments-api', criticality: 'hard' },
          { name: 'pricing-service', criticality: 'soft' },
        ]);
      });
    });

    describe('When the service has no dependents', () => {
      test('Then it returns an empty array', async () => {
        await sut.upsertDependency('payments-api', 'postgres', 'hard');

        const result = await sut.blastRadius('payments-api');

        expect(result).toEqual([]);
      });
    });

    describe('When the service does not exist in the graph at all', () => {
      test('Then it returns an empty array', async () => {
        const result = await sut.blastRadius('unknown-service');

        expect(result).toEqual([]);
      });
    });
  });

  describe('Given dependencyPath', () => {
    describe('When a direct dependency exists between the two services', () => {
      test('Then it returns the two-node path', async () => {
        await sut.upsertDependency('checkout-service', 'payments-api', 'hard');

        const result = await sut.dependencyPath('checkout-service', 'payments-api');

        expect(result).toEqual(['checkout-service', 'payments-api']);
      });
    });

    describe('When only a transitive dependency exists', () => {
      test('Then it returns the shortest full chain of service names between them', async () => {
        await sut.upsertDependency('checkout-service', 'payments-api', 'hard');
        await sut.upsertDependency('payments-api', 'postgres', 'hard');

        const result = await sut.dependencyPath('checkout-service', 'postgres');

        expect(result).toEqual(['checkout-service', 'payments-api', 'postgres']);
      });
    });

    describe('When no dependency path connects the two services', () => {
      test('Then it returns null', async () => {
        await sut.upsertDependency('checkout-service', 'payments-api', 'hard');
        await sut.upsertDependency('webhook-processor', 'kafka', 'hard');

        const result = await sut.dependencyPath('checkout-service', 'kafka');

        expect(result).toBeNull();
      });
    });
  });
});
