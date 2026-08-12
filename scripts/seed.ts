import 'dotenv/config';

import type { EmbedContentRequest } from '@google/generative-ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { incidentLogsTable, incidentsTable, runbooksTable } from '../src/schema';
import { EMBEDDING_MODELS } from '../src/schema/runbooks.schema';
import { SEED_INCIDENTS } from '../src/seed/incident-seed-data';
import { SEED_RUNBOOKS } from '../src/seed/runbook-seed-data';

const EMBEDDING_MODEL = process.env['GEMINI_EMBEDDING_MODEL'] ?? EMBEDDING_MODELS[0];

async function embed(genAi: GoogleGenerativeAI, text: string): Promise<number[]> {
  const model = genAi.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    outputDimensionality: 768,
  } as EmbedContentRequest);
  return result.embedding.values;
}

async function seed(): Promise<void> {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required to seed runbook embeddings — set it in .env');
  }
  const genAi = new GoogleGenerativeAI(apiKey);

  const pool = new Pool({
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
    user: process.env['DB_USER'] ?? 'postgres',
    password: process.env['DB_PASSWORD'] ?? 'postgres',
    database: process.env['DB_NAME'] ?? 'incident_copilot_db',
  });
  const db = drizzle(pool);

  await db.delete(incidentLogsTable);
  await db.delete(incidentsTable);
  await db.delete(runbooksTable);

  for (const seedRunbook of SEED_RUNBOOKS) {
    const embedding = await embed(genAi, `${seedRunbook.title} ${seedRunbook.content}`);
    const searchableText = `${seedRunbook.title} ${seedRunbook.content} ${seedRunbook.services.join(' ')}`;

    await db.insert(runbooksTable).values({
      title: seedRunbook.title,
      content: seedRunbook.content,
      services: seedRunbook.services,
      embedding,
      embeddingModel: EMBEDDING_MODEL as (typeof EMBEDDING_MODELS)[number],
      tsvContent: sql`to_tsvector('english', ${searchableText})`,
    });

    console.log(`Seeded runbook "${seedRunbook.key}"`);
  }

  for (const seedIncident of SEED_INCIDENTS) {
    const occurredAt = new Date(seedIncident.occurredAt);
    const [inserted] = await db
      .insert(incidentsTable)
      .values({
        title: seedIncident.title,
        description: seedIncident.description,
        service: seedIncident.service,
        severity: seedIncident.severity,
        occurredAt,
        groundTruthRootCause: seedIncident.groundTruthRootCause,
        groundTruthExplanation: seedIncident.groundTruthExplanation,
      })
      .returning({ id: incidentsTable.id });

    if (!inserted) {
      throw new Error(`Failed to insert incident: ${seedIncident.key}`);
    }

    await db.insert(incidentLogsTable).values(
      seedIncident.logs.map((log) => ({
        incidentId: inserted.id,
        timestamp: new Date(occurredAt.getTime() + log.offsetMs),
        level: log.level,
        service: log.service,
        message: log.message,
      })),
    );

    console.log(`Seeded incident "${seedIncident.key}" (${inserted.id}) with ${seedIncident.logs.length} log lines`);
  }

  await pool.end();
}

seed()
  .then(() => {
    console.log('Seeding complete.');
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
