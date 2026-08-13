import 'dotenv/config';

import { bootstrapMcpServer } from '../bootstrap-mcp-server';
import { LogSearchMcpModule } from './log-search-mcp.module';

void bootstrapMcpServer({ module: LogSearchMcpModule, name: 'incident-log-search', version: '1.0.0' });
