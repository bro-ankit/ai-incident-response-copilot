import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { OrchestratorService } from '../../agents/orchestrator/orchestrator.service';
import { ENV_VARIABLES } from '../../constants/env.constants';
import { IncidentsRepository } from '../../incidents/incidents.repository';
import type { EvalRunSelect } from '../../schema/eval-runs.schema';
import type { IncidentSelect } from '../../schema/incidents.schema';
import { RunEvalsResponseDto } from '../dto/run-evals-response.dto';
import { EVAL_WEAK_THRESHOLD } from '../evals.constants';
import { EvalsRepository } from '../evals.repository';
import { EvalJudgeService } from '../judge/eval-judge.service';
import { RunEvalsCommand } from './run-evals.command';

const DTO_OPTIONS = { excludeExtraneousValues: true } as const;

@CommandHandler(RunEvalsCommand)
export class RunEvalsCommandHandler implements ICommandHandler<RunEvalsCommand, RunEvalsResponseDto> {
  private readonly interCaseDelayMs?: number;

  constructor(
    @InjectPinoLogger(RunEvalsCommandHandler.name) private readonly logger: PinoLogger,
    private readonly incidentsRepository: IncidentsRepository,
    private readonly orchestratorService: OrchestratorService,
    private readonly evalJudgeService: EvalJudgeService,
    private readonly evalsRepository: EvalsRepository,
    config: ConfigService,
  ) {
    this.interCaseDelayMs = config.get<number>(ENV_VARIABLES.EVAL.INTER_CASE_DELAY_MS);
  }

  async execute(_command: RunEvalsCommand): Promise<RunEvalsResponseDto> {
    this.logger.info('Executing Run Evals Command');

    const incidents = await this.incidentsRepository.findGoldenSet();
    this.logger.info({ total: incidents.length }, 'Starting eval run');

    const stored: EvalRunSelect[] = [];

    for (let i = 0; i < incidents.length; i++) {
      const incident = incidents[i]!;
      try {
        const run = await this.runCase(incident);
        stored.push(run);
        this.logger.info(
          {
            incidentId: incident.id,
            correctness: run.correctnessScore,
            groundedness: run.groundednessScore,
            case: `${i + 1}/${incidents.length}`,
          },
          'Eval case scored',
        );
      } catch (err) {
        this.logger.error({ err, incidentId: incident.id }, 'Eval case failed — skipping');
      }

      if (this.interCaseDelayMs && i < incidents.length - 1) {
        await this.sleep(this.interCaseDelayMs);
      }
    }

    return this.buildSummary(stored);
  }

  private async runCase(incident: IncidentSelect): Promise<EvalRunSelect> {
    const investigation = await this.orchestratorService.investigate(incident.id);
    const topHypothesis = investigation.rootCause?.hypotheses[0] ?? null;

    const scores = topHypothesis
      ? await this.evalJudgeService.score({
          incident,
          hypothesis: topHypothesis,
          logFindings: investigation.logFindings,
          runbookFindings: investigation.runbookFindings,
        })
      : {
          correctness: 0,
          groundedness: 0,
          reasoning: `Pipeline did not produce a hypothesis: ${investigation.warnings.join('; ') || 'unknown failure'}`,
        };

    return this.evalsRepository.insert({
      incidentId: incident.id,
      incidentTitle: incident.title,
      groundTruthRootCause: incident.groundTruthRootCause,
      hypothesis: topHypothesis?.rootCause ?? null,
      logFindings: investigation.logFindings,
      runbookFindings: investigation.runbookFindings,
      correctnessScore: scores.correctness,
      groundednessScore: scores.groundedness,
      reasoning: scores.reasoning,
    });
  }

  private buildSummary(runs: EvalRunSelect[]): RunEvalsResponseDto {
    const n = runs.length;

    const avgCorrectness = n === 0 ? 0 : this.round2(runs.reduce((s, r) => s + r.correctnessScore, 0) / n);
    const avgGroundedness = n === 0 ? 0 : this.round2(runs.reduce((s, r) => s + r.groundednessScore, 0) / n);

    const weakCases = runs
      .filter((r) => r.correctnessScore < EVAL_WEAK_THRESHOLD || r.groundednessScore < EVAL_WEAK_THRESHOLD)
      .map((r) => ({
        incidentTitle: r.incidentTitle,
        correctnessScore: r.correctnessScore,
        groundednessScore: r.groundednessScore,
      }));

    return plainToInstance(
      RunEvalsResponseDto,
      { totalCases: n, avgCorrectness, avgGroundedness, weakCases, runs },
      DTO_OPTIONS,
    );
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
