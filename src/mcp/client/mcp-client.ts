import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import type { AgentTool, AiResponseSchema, AiSchemaProperty, AiSchemaType } from '../../ai/ai.interface';

export type McpClientSpawnConfig = {
  clientName: string;
  command: string;
  args: string[];
};

type McpJsonSchemaProperty = { type?: string; items?: McpJsonSchemaProperty };

type McpToolListing = {
  name: string;
  description?: string;
  inputSchema: { properties?: Record<string, object>; required?: string[] };
};

export abstract class McpClient implements OnModuleInit, OnModuleDestroy {
  private client!: Client;
  private tools: AgentTool[] = [];

  protected abstract readonly spawnConfig: McpClientSpawnConfig;

  protected buildSpawnConfig(clientName: string, relativeServerPath: string): McpClientSpawnConfig {
    return {
      clientName,
      command: process.execPath,
      args: ['-r', 'ts-node/register', '-r', 'dotenv/config', path.join(process.cwd(), relativeServerPath)],
    };
  }

  async onModuleInit(): Promise<void> {
    const transport = new StdioClientTransport({
      command: this.spawnConfig.command,
      args: this.spawnConfig.args,
      env: process.env as Record<string, string>,
    });

    this.client = new Client({ name: this.spawnConfig.clientName, version: '1.0.0' });
    await this.client.connect(transport);

    const { tools } = await this.client.listTools();
    this.tools = tools.map((tool) => this.toAgentTool(tool));
  }

  getTools(): AgentTool[] {
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const result = await this.client.callTool({ name, arguments: args });
    return result.content;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  private toAgentTool(tool: McpToolListing): AgentTool {
    return {
      name: tool.name,
      description: tool.description ?? '',
      parameters: this.toAiResponseSchema(tool.inputSchema),
    };
  }

  private toAiResponseSchema(inputSchema: McpToolListing['inputSchema']): AiResponseSchema {
    const properties = Object.fromEntries(
      Object.entries(inputSchema.properties ?? {}).map(([key, value]) => [
        key,
        this.toAiSchemaProperty(value as McpJsonSchemaProperty),
      ]),
    );
    return { type: 'object', properties, required: inputSchema.required ?? [] };
  }

  private toAiSchemaProperty(prop: McpJsonSchemaProperty): AiSchemaProperty {
    const type = this.toAiSchemaType(prop.type);
    switch (type) {
      case 'array':
        return { type, items: prop.items ? this.toAiSchemaProperty(prop.items) : { type: 'string' } };
      case 'object':
        return { type, properties: {}, required: [] };
      default:
        return { type };
    }
  }

  private toAiSchemaType(jsonSchemaType: string | undefined): AiSchemaType {
    switch (jsonSchemaType) {
      case 'number':
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'array';
      case 'object':
        return 'object';
      default:
        return 'string';
    }
  }
}
