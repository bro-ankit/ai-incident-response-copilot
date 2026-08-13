import type { ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { SetMetadata } from '@nestjs/common';

export const MCP_TOOL_KEY = Symbol('MCP_TOOL_KEY');

export type McpToolMetadata = {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodRawShapeCompat;
};

export const McpTool = (metadata: McpToolMetadata): ClassDecorator => SetMetadata(MCP_TOOL_KEY, metadata);
