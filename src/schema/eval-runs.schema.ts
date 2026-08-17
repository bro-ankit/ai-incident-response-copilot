import type { UUID } from 'node:crypto';

import { doublePrecision, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { incidentsTable } from './incidents.schema';

export const evalRunsTable = pgTable('eval_runs', {
  id: uuid('id').$type<UUID>().primaryKey().defaultRandom(),
  incidentId: uuid('incident_id')
    .$type<UUID>()
    .notNull()
    .references(() => incidentsTable.id),
  incidentTitle: text('incident_title').notNull(),
  groundTruthRootCause: text('ground_truth_root_cause').notNull(),
  hypothesis: text('hypothesis'),
  logFindings: text('log_findings'),
  runbookFindings: text('runbook_findings'),
  correctnessScore: doublePrecision('correctness_score').notNull(),
  groundednessScore: doublePrecision('groundedness_score').notNull(),
  reasoning: text('reasoning').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type EvalRunSelect = typeof evalRunsTable.$inferSelect;
export type EvalRunInsert = typeof evalRunsTable.$inferInsert;
