import { randomUUID } from 'node:crypto';

import type { IncidentSelect } from '../../src/schema/incidents.schema';

export const mockIncidentSelect = (overrides: Partial<IncidentSelect> = {}): IncidentSelect => ({
  id: randomUUID(),
  title: 'payments-api returning 500s after deploy',
  description: 'Error rate spiked to 40% on payments-api shortly after the 14:02 UTC deploy.',
  service: 'payments-api',
  severity: 'SEV2',
  occurredAt: new Date('2026-08-12T14:02:00Z'),
  groundTruthRootCause: 'Missing environment variable in the new deploy caused DB connection pool exhaustion.',
  groundTruthExplanation: 'The new deploy dropped DB_POOL_SIZE, defaulting to a pool of 1, which exhausted under load.',
  isGoldenCase: true,
  createdAt: new Date('2026-08-12T14:05:00Z'),
  ...overrides,
});
