import { RunbooksRepository } from '../../src/runbooks/runbooks.repository';
import type { RunbookInsert } from '../../src/schema/runbooks.schema';
import { runbooksTable } from '../../src/schema/runbooks.schema';
import { mockRunbookInsert } from '../__mocks__/runbook.mock';
import { DrizzleTestEnvironment } from '../helpers/drizzle-test-environment';

const EMBEDDING_A = [...new Array(384).fill(1.0), ...new Array(384).fill(0.0)];
const EMBEDDING_B = [...new Array(384).fill(0.0), ...new Array(384).fill(1.0)];
const QUERY_EMBEDDING = [...new Array(384).fill(0.99), ...new Array(384).fill(0.01)];

describe('RunbooksRepository IT', () => {
  const env = new DrizzleTestEnvironment();
  let sut: RunbooksRepository;

  beforeAll(async () => {
    await env.start([RunbooksRepository]);
    sut = env.module.get(RunbooksRepository);
  }, 60_000);

  afterAll(() => env.stop());

  afterEach(async () => {
    await env.db.delete(runbooksTable);
  });

  const seed = (overrides: Partial<RunbookInsert> = {}) => sut.insert(mockRunbookInsert(overrides));

  describe('Given insert', () => {
    describe('When valid runbook data is provided', () => {
      test('Then it persists the runbook, returns it with a generated id and computed tsvContent, and exactly one row exists in the database', async () => {
        const result = await seed({ embedding: EMBEDDING_A });

        expect(result).toEqual({
          id: expect.any(String),
          title: 'Runbook: Service OOMKilled / CrashLoopBackOff after a deploy',
          content: 'Symptoms: pods restart every few minutes shortly after a deploy.',
          services: [],
          embedding: EMBEDDING_A,
          embeddingModel: 'gemini-embedding-001',
          tsvContent: expect.any(String),
          createdAt: expect.any(Date),
        });

        const rows = await env.db.select().from(runbooksTable);
        expect(rows).toEqual([result]);
      });
    });
  });

  describe('Given findSimilarIds', () => {
    describe('When two runbooks with different embeddings exist for the queried model', () => {
      test('Then it returns ids ordered by cosine similarity, closest first, and limit is respected', async () => {
        const a = await seed({ embedding: EMBEDDING_A });
        const b = await seed({ embedding: EMBEDDING_B });

        const results = await sut.findSimilarIds(QUERY_EMBEDDING, 2, 'gemini-embedding-001');
        expect(results).toEqual([a.id, b.id]);

        const limited = await sut.findSimilarIds(QUERY_EMBEDDING, 1, 'gemini-embedding-001');
        expect(limited).toEqual([a.id]);
      });
    });

    describe('When a runbook was embedded with a different model', () => {
      test('Then it is excluded from results even though it has an embedding', async () => {
        await seed({ embedding: EMBEDDING_A, embeddingModel: 'stale-model' as never });
        const b = await seed({ embedding: EMBEDDING_B });

        const results = await sut.findSimilarIds(QUERY_EMBEDDING, 3, 'gemini-embedding-001');

        expect(results).toEqual([b.id]);
      });
    });

    describe('When no runbooks exist', () => {
      test('Then it returns an empty array', async () => {
        const results = await sut.findSimilarIds(QUERY_EMBEDDING, 3, 'gemini-embedding-001');
        expect(results).toEqual([]);
      });
    });
  });

  describe('Given findByLexical', () => {
    describe('When a runbook matches the query text', () => {
      test('Then it returns only that runbook id, and limit is respected', async () => {
        const a = await seed({ title: 'Runbook: Service OOMKilled after a deploy' });
        await seed({ title: 'Runbook: DB connection pool exhaustion under load' });

        const results = await sut.findByLexical('OOMKilled deploy', 10);
        expect(results).toEqual([a.id]);

        const limited = await sut.findByLexical('OOMKilled deploy', 0);
        expect(limited).toEqual([]);
      });
    });

    describe('When no runbook matches the query text', () => {
      test('Then it returns an empty array', async () => {
        await seed();

        const results = await sut.findByLexical('unrelated topic xyz', 10);

        expect(results).toEqual([]);
      });
    });
  });

  describe('Given findByIds', () => {
    describe('When called with an empty array', () => {
      test('Then it returns an empty array without querying the database', async () => {
        const results = await sut.findByIds([]);
        expect(results).toEqual([]);
      });
    });

    describe('When called with ids that exist', () => {
      test('Then it returns exactly the matching runbooks', async () => {
        const a = await seed();
        await seed();

        const results = await sut.findByIds([a.id]);

        expect(results).toEqual([a]);
      });
    });
  });
});
