import type { UUID } from 'node:crypto';

export class InvestigateIncidentCommand {
  constructor(public readonly incidentId: UUID) {}
}
