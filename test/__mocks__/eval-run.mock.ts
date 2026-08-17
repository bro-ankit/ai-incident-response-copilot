import { randomUUID } from 'node:crypto';

import type { EvalRunSelect } from '../../src/schema/eval-runs.schema';

export const mockEvalRunSelect = (overrides: Partial<EvalRunSelect> = {}): EvalRunSelect => ({
  id: randomUUID(),
  incidentId: randomUUID(),
  incidentTitle: 'payments-api pods crash-looping after v2.14.0 deploy',
  groundTruthRootCause: 'Memory leak in the new idempotency-key cache introduced in v2.14.0.',
  hypothesis: 'Memory leak in idempotency cache',
  logFindings: 'Found repeated heap growth leading to OOMKilled.',
  runbookFindings: 'Matched runbook: unbounded in-memory cache OOM.',
  correctnessScore: 0.9,
  groundednessScore: 0.85,
  reasoning: 'Matches ground truth and is grounded in the findings.',
  createdAt: new Date('2026-08-17T00:00:00Z'),
  ...overrides,
});
