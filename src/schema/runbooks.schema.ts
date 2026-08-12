import type { UUID } from 'node:crypto';

import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { tsvector } from './tsvector.type';
import { getGeminiVector } from './vector.type';

export const EMBEDDING_MODELS = ['gemini-embedding-001'] as const;
export type EmbeddingModel = (typeof EMBEDDING_MODELS)[number];

const DEFAULT_EMBEDDING_MODEL: EmbeddingModel = 'gemini-embedding-001';

export const runbooksTable = pgTable('runbooks', {
  id: uuid('id').$type<UUID>().primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  services: text('services').array().notNull().default([]),
  embedding: getGeminiVector('embedding').notNull(),
  embeddingModel: text('embedding_model').$type<EmbeddingModel>().notNull().default(DEFAULT_EMBEDDING_MODEL),
  tsvContent: tsvector('tsv_content'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type RunbookSelect = typeof runbooksTable.$inferSelect;
export type RunbookInsert = typeof runbooksTable.$inferInsert;
