import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';
import { ConfigService } from '@nestjs/config';

import { AI_CLIENT } from '../../../src/ai/ai.constants';
import type { IAiClient } from '../../../src/ai/ai.interface';
import { RunbooksRepository } from '../../../src/runbooks/runbooks.repository';
import { RerankerService } from '../../../src/runbooks/search/reranker.service';
import { SearchService } from '../../../src/runbooks/search/search.service';
import { mockRunbookSelect } from '../../__mocks__/runbook.mock';

describe('SearchService Unit Test', () => {
  let sut: SearchService;
  let aiClient: jest.Mocked<IAiClient>;
  let runbooksRepository: jest.Mocked<RunbooksRepository>;
  let rerankerService: jest.Mocked<RerankerService>;

  const QUERY = 'pods restarting with OOMKilled after a deploy';
  const EMBEDDING = new Array(768).fill(0.05);

  const IDS = [randomUUID(), randomUUID(), randomUUID()];

  const RUNBOOK_1 = mockRunbookSelect({
    id: IDS[0],
    title: 'Runbook: Service OOMKilled / CrashLoopBackOff after a deploy',
    content: 'Symptoms: pods restart every few minutes after a deploy.',
    services: ['payments-api'],
  });
  const RUNBOOK_2 = mockRunbookSelect({
    id: IDS[1],
    title: 'Runbook: DB connection pool exhaustion under load',
    content: '504s rise sharply during a traffic spike.',
    services: ['checkout-service'],
  });
  const RUNBOOK_3 = mockRunbookSelect({
    id: IDS[2],
    title: 'Runbook: TLS handshake failures after certificate expiry',
    content: 'Clients suddenly cannot establish TLS connections.',
    services: ['api-gateway'],
  });

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(SearchService)
      .mock(ConfigService)
      .using({ get: (_key: string, defaultValue?: unknown) => defaultValue })
      .compile();
    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
    runbooksRepository = unitRef.get(RunbooksRepository);
    rerankerService = unitRef.get(RerankerService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given search', () => {
    describe('When both vector and lexical results exist', () => {
      test('Then it embeds the query, queries both retrievers with CANDIDATE_K in parallel, reranks the RRF-fused pool, and returns entities in reranked order', async () => {
        aiClient.generateEmbedding.mockResolvedValue(EMBEDDING);
        runbooksRepository.findSimilarIds.mockResolvedValue([IDS[0], IDS[1], IDS[2]]);
        runbooksRepository.findByLexical.mockResolvedValue([IDS[0], IDS[2]]);
        runbooksRepository.findByIds.mockResolvedValue([RUNBOOK_1, RUNBOOK_3, RUNBOOK_2]);
        rerankerService.rerank.mockResolvedValue([
          { id: IDS[2], score: 5 },
          { id: IDS[0], score: 2 },
          { id: IDS[1], score: -1 },
        ]);

        const results = await sut.search(QUERY);

        expect(results).toEqual([RUNBOOK_3, RUNBOOK_1, RUNBOOK_2]);

        expect(aiClient.generateEmbedding).toHaveBeenCalledWith(QUERY);
        expect(runbooksRepository.findSimilarIds).toHaveBeenCalledWith(EMBEDDING, 20, 'gemini-embedding-001');
        expect(runbooksRepository.findByLexical).toHaveBeenCalledWith(QUERY, 20);

        expect(rerankerService.rerank).toHaveBeenCalledWith(QUERY, [
          { id: IDS[0], text: `${RUNBOOK_1.title} ${RUNBOOK_1.content}` },
          { id: IDS[2], text: `${RUNBOOK_3.title} ${RUNBOOK_3.content}` },
          { id: IDS[1], text: `${RUNBOOK_2.title} ${RUNBOOK_2.content}` },
        ]);

        const similarCall = runbooksRepository.findSimilarIds.mock.invocationCallOrder[0];
        const lexicalCall = runbooksRepository.findByLexical.mock.invocationCallOrder[0];
        const byIdsCall = runbooksRepository.findByIds.mock.invocationCallOrder[0];
        expect(similarCall).toBeLessThan(byIdsCall);
        expect(lexicalCall).toBeLessThan(byIdsCall);
      });
    });

    describe('When only vector results exist (no lexical matches)', () => {
      test('Then it still returns the top 3 in reranked order', async () => {
        aiClient.generateEmbedding.mockResolvedValue(EMBEDDING);
        runbooksRepository.findSimilarIds.mockResolvedValue([IDS[0], IDS[1], IDS[2]]);
        runbooksRepository.findByLexical.mockResolvedValue([]);
        runbooksRepository.findByIds.mockResolvedValue([RUNBOOK_1, RUNBOOK_2, RUNBOOK_3]);
        rerankerService.rerank.mockResolvedValue([
          { id: IDS[0], score: 3 },
          { id: IDS[1], score: 1 },
          { id: IDS[2], score: 0 },
        ]);

        const results = await sut.search(QUERY);

        expect(results).toEqual([RUNBOOK_1, RUNBOOK_2, RUNBOOK_3]);
      });
    });

    describe('When neither retriever finds anything', () => {
      test('Then it returns an empty array without calling findByIds or the reranker', async () => {
        aiClient.generateEmbedding.mockResolvedValue(EMBEDDING);
        runbooksRepository.findSimilarIds.mockResolvedValue([]);
        runbooksRepository.findByLexical.mockResolvedValue([]);

        const results = await sut.search(QUERY);

        expect(results).toEqual([]);
        expect(runbooksRepository.findByIds).not.toHaveBeenCalled();
        expect(rerankerService.rerank).not.toHaveBeenCalled();
      });
    });
  });
});
