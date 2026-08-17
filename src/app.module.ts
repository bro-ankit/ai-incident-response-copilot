import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { AgentsModule } from './agents/agents.module';
import { AppService } from './app.service';
import { CoreInfraModule } from './core-infra.module';
import { IncidentsModule } from './incidents/incidents.module';
import { McpClientsModule } from './mcp/client/mcp-clients.module';
import { RunbooksModule } from './runbooks/runbooks.module';

@Module({
  imports: [
    CoreInfraModule,
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env['NODE_ENV'] !== 'production' ? { target: 'pino-pretty' } : undefined,
        redact: {
          paths: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-api-key"]'],
          censor: '[REDACTED]',
        },
      },
    }),
    RunbooksModule,
    IncidentsModule,
    McpClientsModule,
    AgentsModule,
  ],
  providers: [AppService],
})
export class AppModule {}
