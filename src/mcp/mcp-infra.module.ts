import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { CoreInfraModule } from '../core-infra.module';
import { buildStderrPinoHttpOptions } from './stderr-pino-options';

// Shared plumbing for every MCP server process. Domain modules and tool
// providers are NOT included here — each server imports this plus only the
// domain module its own tool needs, so tool discovery (see
// McpToolDiscoveryModule) only ever sees the tools that server should expose.
@Module({
  imports: [
    CoreInfraModule,
    LoggerModule.forRoot({ pinoHttp: buildStderrPinoHttpOptions(process.env['NODE_ENV'] === 'production') }),
  ],
})
export class McpInfraModule {}
