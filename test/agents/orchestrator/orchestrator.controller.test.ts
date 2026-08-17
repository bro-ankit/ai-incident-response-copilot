import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { InvestigateIncidentCommand } from '../../../src/agents/orchestrator/investigate-incident.command';
import { OrchestratorController } from '../../../src/agents/orchestrator/orchestrator.controller';

describe('OrchestratorController Supertest', () => {
  let app: INestApplication;
  let commandBus: jest.Mocked<CommandBus>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrchestratorController],
      providers: [{ provide: CommandBus, useValue: { execute: jest.fn() } }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    commandBus = module.get(CommandBus);
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  describe('Given POST /incidents/:incidentId/investigate', () => {
    describe('When called with a valid incident id', () => {
      test('Then it returns 201 with the result and forwards an InvestigateIncidentCommand built from the id to the command bus', async () => {
        const incidentId = randomUUID();
        const result = {
          incidentId,
          logFindings: 'log findings',
          runbookFindings: 'runbook findings',
          hypotheses: [],
          remediationSteps: [],
        };
        commandBus.execute.mockResolvedValue(result);

        const res = await request(app.getHttpServer()).post(`/incidents/${incidentId}/investigate`).expect(201);

        expect(res.body).toEqual(result);
        expect(commandBus.execute).toHaveBeenCalledWith(new InvestigateIncidentCommand(incidentId));
      });
    });

    describe('When called with a non-UUID incident id', () => {
      test('Then it returns 400 and does not call the command bus', async () => {
        await request(app.getHttpServer()).post('/incidents/not-a-uuid/investigate').expect(400);

        expect(commandBus.execute).not.toHaveBeenCalled();
      });
    });
  });
});
