import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreInfraModule } from './core-infra.module';
import { IncidentsModule } from './incidents/incidents.module';
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
