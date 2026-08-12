import { TestBed } from '@automock/jest';

import { SearchQuery } from '../../../src/runbooks/search/search.query';
import { SearchQueryHandler } from '../../../src/runbooks/search/search.query-handler';
import { SearchService } from '../../../src/runbooks/search/search.service';
import { mockRunbookSelect } from '../../__mocks__/runbook.mock';

describe('SearchQueryHandler Unit Test', () => {
  let sut: SearchQueryHandler;
  let searchService: jest.Mocked<SearchService>;

  const RUNBOOK = mockRunbookSelect({
    title: 'Runbook: Service OOMKilled / CrashLoopBackOff after a deploy',
    content: 'Symptoms: pods restart every few minutes after a deploy.',
    services: ['payments-api'],
    createdAt: new Date('2026-08-12T00:00:00Z'),
  });

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(SearchQueryHandler).compile();
    sut = unit;
    searchService = unitRef.get(SearchService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given execute', () => {
    describe('When runbooks are found', () => {
      test('Then it delegates the query string to SearchService and returns SearchResultDtos mapped from the entities, excluding embedding, embeddingModel and tsvContent', async () => {
        searchService.search.mockResolvedValue([RUNBOOK]);

        const results = await sut.execute(new SearchQuery('OOMKilled after a deploy'));

        expect(searchService.search).toHaveBeenCalledWith('OOMKilled after a deploy');
        expect(results).toEqual([
          {
            id: RUNBOOK.id,
            title: 'Runbook: Service OOMKilled / CrashLoopBackOff after a deploy',
            content: 'Symptoms: pods restart every few minutes after a deploy.',
            services: ['payments-api'],
            createdAt: new Date('2026-08-12T00:00:00Z'),
          },
        ]);
      });
    });

    describe('When no runbooks are found', () => {
      test('Then it returns an empty array', async () => {
        searchService.search.mockResolvedValue([]);

        const results = await sut.execute(new SearchQuery('unknown topic'));

        expect(results).toEqual([]);
      });
    });
  });
});
