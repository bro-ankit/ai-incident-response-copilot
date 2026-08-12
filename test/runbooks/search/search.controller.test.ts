import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { SearchController } from '../../../src/runbooks/search/search.controller';
import { SearchQuery } from '../../../src/runbooks/search/search.query';
import { mockSearchResultDto } from '../../__mocks__/runbook.mock';

describe('SearchController Supertest', () => {
  let app: INestApplication;
  let queryBus: jest.Mocked<QueryBus>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: QueryBus, useValue: { execute: jest.fn() } }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    queryBus = module.get(QueryBus);
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  describe('Given GET /runbooks/search', () => {
    describe('When called with a q param', () => {
      test('Then it returns 200 with the results and forwards a SearchQuery built from q to the query bus', async () => {
        const result = mockSearchResultDto();
        queryBus.execute.mockResolvedValue([result]);

        const res = await request(app.getHttpServer())
          .get('/runbooks/search')
          .query({ q: 'OOMKilled after a deploy' })
          .expect(200);

        expect(res.body).toEqual([{ ...result, createdAt: result.createdAt.toISOString() }]);
        expect(queryBus.execute).toHaveBeenCalledWith(new SearchQuery('OOMKilled after a deploy'));
      });
    });

    describe('When called without a q param', () => {
      test('Then it returns 400 and does not call the query bus', async () => {
        await request(app.getHttpServer()).get('/runbooks/search').expect(400);

        expect(queryBus.execute).not.toHaveBeenCalled();
      });
    });

    describe('When called with an empty q param', () => {
      test('Then it returns 400 and does not call the query bus', async () => {
        await request(app.getHttpServer()).get('/runbooks/search').query({ q: '' }).expect(400);

        expect(queryBus.execute).not.toHaveBeenCalled();
      });
    });

    describe('When called with an unknown extra field', () => {
      test('Then it returns 400 due to forbidNonWhitelisted', async () => {
        await request(app.getHttpServer()).get('/runbooks/search').query({ q: 'OOMKilled', extra: 'nope' }).expect(400);

        expect(queryBus.execute).not.toHaveBeenCalled();
      });
    });
  });
});
