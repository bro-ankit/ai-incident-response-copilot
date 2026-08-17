import type { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { RunEvalsCommand } from '../../src/evals/commands/run-evals.command';
import { EvalsController } from '../../src/evals/evals.controller';

describe('EvalsController Supertest', () => {
  let app: INestApplication;
  let commandBus: jest.Mocked<CommandBus>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvalsController],
      providers: [{ provide: CommandBus, useValue: { execute: jest.fn() } }],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    commandBus = module.get(CommandBus);
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  describe('Given POST /evals/run', () => {
    describe('When called', () => {
      test('Then it returns 201 with the summary and forwards a RunEvalsCommand to the command bus', async () => {
        const summary = {
          totalCases: 6,
          avgCorrectness: 0.82,
          avgGroundedness: 0.79,
          weakCases: [],
          runs: [],
        };
        commandBus.execute.mockResolvedValue(summary);

        const res = await request(app.getHttpServer()).post('/evals/run').expect(201);

        expect(res.body).toEqual(summary);
        expect(commandBus.execute).toHaveBeenCalledWith(new RunEvalsCommand());
      });
    });
  });
});
