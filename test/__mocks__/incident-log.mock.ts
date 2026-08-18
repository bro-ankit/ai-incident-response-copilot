import type { UUID } from 'node:crypto';
import { randomUUID } from 'node:crypto';

import type { IncidentLogInsert } from '../../src/schema/incident-logs.schema';

export const mockIncidentLogInsert = (overrides: Partial<IncidentLogInsert> = {}): IncidentLogInsert => ({
  incidentId: randomUUID() as UUID,
  timestamp: new Date('2026-08-12T14:02:00Z'),
  level: 'INFO',
  service: 'payments-api',
  message: 'Deployment v2.14.0 rollout started',
  ...overrides,
});
