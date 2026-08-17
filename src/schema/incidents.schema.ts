import type { UUID } from 'node:crypto';

import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const INCIDENT_SEVERITIES = ['SEV1', 'SEV2', 'SEV3', 'SEV4'] as const;

export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const incidentsTable = pgTable('incidents', {
  id: uuid('id').$type<UUID>().primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  service: text('service').notNull(),
  severity: text('severity').$type<IncidentSeverity>().notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  groundTruthRootCause: text('ground_truth_root_cause').notNull(),
  groundTruthExplanation: text('ground_truth_explanation').notNull(),
  // A curated, stable subset used by the eval harness — not every incident that ever exists in
  // this table. Real incidents accumulate over time; evals must run against a fixed reference set,
  // not "all of them," or the eval run grows unbounded and stops being reproducible.
  isGoldenCase: boolean('is_golden_case').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type IncidentSelect = typeof incidentsTable.$inferSelect;
export type IncidentInsert = typeof incidentsTable.$inferInsert;
