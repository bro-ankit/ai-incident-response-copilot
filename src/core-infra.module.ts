import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AiModule } from './ai/ai.module';
import { DatabaseModule } from './database/database.module';
import { MetricsModule } from './metrics/metrics.module';
import { ResilienceModule } from './resilience';

// Infra shared by every composition root in this codebase (the HTTP app,
// and each standalone MCP server process). Only logging is excluded — each
// composition root needs a different destination (stdout for the HTTP app,
// stderr for MCP stdio servers, which must keep stdout clean for protocol
// frames), so LoggerModule.forRoot() stays local to each root instead.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ResilienceModule, MetricsModule, DatabaseModule, AiModule],
})
export class CoreInfraModule {}
