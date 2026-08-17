import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { CoreInfraModule } from '../core-infra.module';
import { buildStderrPinoHttpOptions } from './stderr-pino-options';

@Module({
  imports: [
    CoreInfraModule,
    LoggerModule.forRoot({ pinoHttp: buildStderrPinoHttpOptions(process.env['NODE_ENV'] === 'production') }),
  ],
})
export class McpInfraModule {}
