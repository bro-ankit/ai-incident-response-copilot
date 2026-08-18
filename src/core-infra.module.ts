import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AiModule } from './ai/ai.module';
import { DatabaseModule } from './database/database.module';
import { MetricsModule } from './metrics/metrics.module';
import { ResilienceModule } from './resilience';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ResilienceModule, MetricsModule, DatabaseModule, AiModule],
})
export class CoreInfraModule {}
