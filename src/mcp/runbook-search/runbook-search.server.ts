import 'dotenv/config';

import { bootstrapMcpServer } from '../bootstrap-mcp-server';
import { RunbookSearchMcpModule } from './runbook-search-mcp.module';

void bootstrapMcpServer({ module: RunbookSearchMcpModule, name: 'runbook-search', version: '1.0.0' });
