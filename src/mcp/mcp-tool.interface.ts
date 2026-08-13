import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface IMcpToolHandler {
  execute(args: Record<string, unknown>): Promise<CallToolResult>;
}
