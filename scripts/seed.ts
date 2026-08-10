import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { incidentLogsTable, incidentsTable } from '../src/schema';
import { SEED_INCIDENTS } from '../src/seed/incident-seed-data';

async function seed(): Promise<void> {
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
