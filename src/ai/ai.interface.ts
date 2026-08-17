export type AiSchemaType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export type AiSchemaProperty =
  | { type: 'string' }
  | { type: 'number' }
  | { type: 'boolean' }
  | { type: 'array'; items: AiSchemaProperty }
  | { type: 'object'; properties: Record<string, AiSchemaProperty>; required: string[] };

export type AiResponseSchema = Extract<AiSchemaProperty, { type: 'object' }>;

export type AgentTool = {
  name: string;
  description: string;
  parameters: AiResponseSchema;
};

export type AgentMessage =
  | { role: 'user'; text: string }
  | { role: 'model'; text: string }
  // thoughtSignature: opaque token some Gemini models attach to a function-call part and
  // require verbatim on the next turn's history — see gemini.client.ts's toGeminiHistory.
  | { role: 'tool_call'; toolName: string; args: Record<string, unknown>; thoughtSignature?: string }
  | { role: 'tool_result'; toolName: string; result: unknown };

export type AgentTurnResult =
  | { type: 'tool_call'; toolName: string; args: Record<string, unknown>; thoughtSignature?: string }
  | { type: 'final_answer'; text: string };

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export interface IAiClient {
  generateStructured(prompt: string, schema: AiResponseSchema): Promise<unknown>;
  generateEmbedding(text: string): Promise<number[]>;
  generateText(systemPrompt: string, userMessage: string): Promise<string>;
  generateWithTools(systemPrompt: string, history: AgentMessage[], tools: AgentTool[]): Promise<AgentTurnResult>;
  generateTextStream(systemPrompt: string, userMessage: string): AsyncIterable<string>;
}
