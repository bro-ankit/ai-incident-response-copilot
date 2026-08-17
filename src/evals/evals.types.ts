import type { IncidentSelect } from '../schema/incidents.schema';

export type EvalJudgeInput = {
  readonly incident: IncidentSelect;
  readonly hypothesis: { rootCause: string; confidence: number; reasoning: string };
  readonly logFindings: string | null;
  readonly runbookFindings: string | null;
};

export type EvalJudgeResult = {
  readonly correctness: number;
  readonly groundedness: number;
  readonly reasoning: string;
};
