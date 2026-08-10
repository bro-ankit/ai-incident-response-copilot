import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { incidentsTable } from './incidents.schema';

export const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export const incidentLogsTable = pgTable('incident_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  incidentId: uuid('incident_id')
    .notNull()
    .references(() => incidentsTable.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  level: text('level').$type<LogLevel>().notNull(),
  service: text('service').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type IncidentLogSelect = typeof incidentLogsTable.$inferSelect;
export type IncidentLogInsert = typeof incidentLogsTable.$inferInsert;
