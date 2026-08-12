import { randomUUID } from 'node:crypto';

import type { SearchResultDto } from '../../src/runbooks/dto/search-result.dto';
import type { RunbookInsert, RunbookSelect } from '../../src/schema/runbooks.schema';

export const mockRunbookSelect = (overrides: Partial<RunbookSelect> = {}): RunbookSelect => ({
  id: randomUUID(),
  title: 'Runbook: Service OOMKilled / CrashLoopBackOff after a deploy',
  content: 'Symptoms: pods restart every few minutes shortly after a deploy.',
  services: [],
  embedding: new Array(768).fill(0),
  embeddingModel: 'gemini-embedding-001',
  tsvContent: null,
  createdAt: new Date('2026-08-12T00:00:00Z'),
  ...overrides,
});

export const mockRunbookInsert = (overrides: Partial<RunbookInsert> = {}): RunbookInsert => ({
  title: 'Runbook: Service OOMKilled / CrashLoopBackOff after a deploy',
  content: 'Symptoms: pods restart every few minutes shortly after a deploy.',
  services: [],
  embedding: new Array(768).fill(0),
  embeddingModel: 'gemini-embedding-001',
  ...overrides,
});

export const mockSearchResultDto = (overrides: Partial<SearchResultDto> = {}): SearchResultDto => ({
  id: randomUUID(),
  title: 'Runbook: Service OOMKilled / CrashLoopBackOff after a deploy',
  content: 'Symptoms: pods restart every few minutes shortly after a deploy.',
  services: [],
  createdAt: new Date('2026-08-12T00:00:00Z'),
  ...overrides,
});
