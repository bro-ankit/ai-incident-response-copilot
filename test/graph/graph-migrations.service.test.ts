import { GRAPH_MIGRATIONS } from '../../src/graph/graph-migrations';
import { GraphTestEnvironment } from '../helpers/graph-test-environment';
import { AssertUtils } from '../utils/assert.utils';

describe('GraphMigrationsService IT', () => {
  const env = new GraphTestEnvironment();

  afterEach(async () => {
    await env.clear();
    await env.stop();
  });

  describe('Given onModuleInit', () => {
    describe('When the module boots against a fresh database', () => {
      test('Then it applies every migration and records one tracking node per migration id', async () => {
        await env.start();

        const session = env.driver.session();
        try {
          const result = await session.run<{ id: string }>('MATCH (m:_GraphMigration) RETURN m.id AS id');
          const appliedIds = result.records.map((record) => record.get('id')).sort();

          expect(appliedIds).toEqual([...GRAPH_MIGRATIONS.map((m) => m.id)].sort());
        } finally {
          await session.close();
        }
      }, 60_000);
    });

    describe('When the constraint migration has run', () => {
      test('Then a raw CREATE of a second Service node with the same name is rejected', async () => {
        await env.start();

        const session = env.driver.session();
        try {
          await session.run('CREATE (:Service {name: $name})', { name: 'payments-api' });

          await AssertUtils.assertError(
            () => session.run('CREATE (:Service {name: $name})', { name: 'payments-api' }),
            "Node(2) already exists with label `Service` and property `name` = 'payments-api'",
          );
        } finally {
          await session.close();
        }
      }, 60_000);
    });
  });
});
