import { Neo4jContainer, type StartedNeo4jContainer } from '@testcontainers/neo4j';
import neo4j, { type Driver } from 'neo4j-driver';
import { PinoLogger } from 'nestjs-pino';

import { GRAPH_MIGRATIONS } from '../../src/graph/graph-migrations';
import { GraphMigrationsService } from '../../src/graph/graph-migrations.service';

const NEO4J_IMAGE = 'neo4j:5-community';
const PASSWORD = 'password12345';

// Two GraphMigrationsService instances, each with its own real Driver connection to the same
// container — mimicking two separate replica processes racing to migrate the same database, not two
// sessions sharing one driver (which wouldn't exercise the same real-world race).
describe('GraphMigrationsService concurrency IT', () => {
  let container: StartedNeo4jContainer;
  let driverA: Driver;
  let driverB: Driver;

  beforeAll(async () => {
    container = await new Neo4jContainer(NEO4J_IMAGE).withPassword(PASSWORD).start();
    const uri = container.getBoltUri();
    const auth = neo4j.auth.basic(container.getUsername(), PASSWORD);
    driverA = neo4j.driver(uri, auth);
    driverB = neo4j.driver(uri, auth);
  }, 60_000);

  afterAll(async () => {
    await driverA.close();
    await driverB.close();
    await container.stop();
  });

  describe('Given two replicas booting concurrently against the same fresh database', () => {
    describe('When both run onModuleInit at the same time', () => {
      test('Then migrations are applied exactly once — no duplicate tracking nodes, no error from either replica', async () => {
        const silentLogger = {
          info: () => {},
          warn: () => {},
          error: () => {},
          debug: () => {},
        } as unknown as PinoLogger;
        const serviceA = new GraphMigrationsService(silentLogger, driverA);
        const serviceB = new GraphMigrationsService(silentLogger, driverB);

        await expect(Promise.all([serviceA.onModuleInit(), serviceB.onModuleInit()])).resolves.toBeDefined();

        const session = driverA.session();
        try {
          const result = await session.run<{ id: string }>('MATCH (m:_GraphMigration) RETURN m.id AS id');
          expect(result.records.map((r) => r.get('id')).sort()).toEqual([...GRAPH_MIGRATIONS.map((m) => m.id)].sort());

          const lockResult = await session.run<{ active: boolean }>(
            'MATCH (l:_GraphMigrationLock {id: 1}) RETURN l.active AS active',
          );
          expect(lockResult.records).toHaveLength(1);
          expect(lockResult.records[0]!.get('active')).toBe(false);
        } finally {
          await session.close();
        }
      }, 60_000);
    });
  });
});
