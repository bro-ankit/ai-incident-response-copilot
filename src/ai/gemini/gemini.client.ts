import {
  type Content,
  EmbedContentRequest,
  type EnhancedGenerateContentResponse,
  FunctionDeclarationSchema,
  GoogleGenerativeAI,
  type Part,
  type Schema,
  SchemaType,
} from '@google/generative-ai';
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { ENV_VARIABLES } from '../../constants/env.constants';
import { AiUsageContextService } from '../../metrics/ai-usage-context.service';
import { MetricsReporter } from '../../metrics/metrics.reporter';
import { Resilient } from '../../resilience';
import type {
  AgentMessage,
  AgentTool,
  AgentTurnResult,
  AiResponseSchema,
  AiSchemaProperty,
  IAiClient,
  TokenUsage,
} from '../ai.interface';
import { GEMINI_CLIENT, GEMINI_COST_DEFAULTS, GEMINI_ERRORS, GEMINI_MODEL_DEFAULTS } from './gemini.constants';

@Injectable()
export class GeminiClient implements IAiClient {
  private readonly costInputPerMillion: number;
  private readonly costOutputPerMillion: number;
  private readonly costEmbeddingPerMillion: number;
  private readonly generationModel: string;
  private readonly embeddingModel: string;

  constructor(
    @InjectPinoLogger(GeminiClient.name) private readonly logger: PinoLogger,
    @Inject(GEMINI_CLIENT) private readonly client: GoogleGenerativeAI,
    config: ConfigService,
    private readonly metricsReporter: MetricsReporter,
    private readonly usageContext: AiUsageContextService,
  ) {
    this.costInputPerMillion = config.get<number>(
      ENV_VARIABLES.GEMINI.COST_INPUT_PER_MILLION,
      GEMINI_COST_DEFAULTS.INPUT,
    );
    this.costOutputPerMillion = config.get<number>(
      ENV_VARIABLES.GEMINI.COST_OUTPUT_PER_MILLION,
      GEMINI_COST_DEFAULTS.OUTPUT,
    );
    this.costEmbeddingPerMillion = config.get<number>(
      ENV_VARIABLES.GEMINI.COST_EMBEDDING_PER_MILLION,
      GEMINI_COST_DEFAULTS.EMBEDDING,
    );
    this.generationModel = config.get<string>(ENV_VARIABLES.GEMINI.GENERATION_MODEL, GEMINI_MODEL_DEFAULTS.GENERATION);
    this.embeddingModel = config.get<string>(ENV_VARIABLES.GEMINI.EMBEDDING_MODEL, GEMINI_MODEL_DEFAULTS.EMBEDDING);
  }

  async generateStructured(prompt: string, schema: AiResponseSchema): Promise<unknown> {
    this.logger.info({ model: this.generationModel }, 'Sending structured generation request');

    const model = this.client.getGenerativeModel({
      model: this.generationModel,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: this.toGeminiSchema(schema),
      },
    });

    const start = Date.now();
    let rawText: string;
    let usage: TokenUsage;
    try {
      const result = await model.generateContent(prompt);
      rawText = result.response.text();
      usage = this.extractUsage(result.response.usageMetadata);
      this.logger.debug({ usage }, 'Structured generation token usage');
    } catch (err) {
      this.logger.error({ err }, GEMINI_ERRORS.API_CALL_FAILED);
      throw new InternalServerErrorException(GEMINI_ERRORS.API_CALL_FAILED, { cause: err });
    }

    this.recordUsage(usage, Date.now() - start);
    return this.parseJson(rawText);
  }

  async generateText(systemPrompt: string, userMessage: string): Promise<string> {
    this.logger.info({ model: this.generationModel }, 'Sending free-text generation request');

    const model = this.client.getGenerativeModel({
      model: this.generationModel,
      systemInstruction: systemPrompt,
    });

    const start = Date.now();
    try {
      const result = await model.generateContent(userMessage);
      const usage = this.extractUsage(result.response.usageMetadata);

      this.logger.debug({ usage }, 'Free-text generation token usage');
      this.recordUsage(usage, Date.now() - start);

      return result.response.text();
    } catch (err) {
      this.logger.error({ err }, GEMINI_ERRORS.API_CALL_FAILED);
      throw new InternalServerErrorException(GEMINI_ERRORS.API_CALL_FAILED, { cause: err });
    }
  }

  async generateWithTools(systemPrompt: string, history: AgentMessage[], tools: AgentTool[]): Promise<AgentTurnResult> {
    this.logger.info({ model: this.generationModel, historyLength: history.length }, 'Agent turn with tools');

    const model = this.client.getGenerativeModel({
      model: this.generationModel,
      systemInstruction: systemPrompt,
      tools: [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: this.toGeminiSchema(t.parameters) as FunctionDeclarationSchema,
          })),
        },
      ],
    });

    const conversationHistory = this.toGeminiHistory(history.slice(0, -1));
    const lastParts = this.toLastParts(history[history.length - 1]);

    const start = Date.now();
    try {
      const chat = model.startChat({ history: conversationHistory });
      const result = await chat.sendMessage(lastParts);
      const usage = this.extractUsage(result.response.usageMetadata);
      const functionCalls = result.response.functionCalls();

      this.recordUsage(usage, Date.now() - start);

      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        return {
          type: 'tool_call',
          toolName: call.name,
          args: call.args as Record<string, unknown>,
          thoughtSignature: this.extractThoughtSignature(result.response, call.name),
        };
      }

      return { type: 'final_answer', text: result.response.text() };
    } catch (err) {
      this.logger.error({ err }, GEMINI_ERRORS.API_CALL_FAILED);
      throw new InternalServerErrorException(GEMINI_ERRORS.API_CALL_FAILED, { cause: err });
    }
  }

  async *generateTextStream(systemPrompt: string, userMessage: string): AsyncIterable<string> {
    this.logger.info({ model: this.generationModel }, 'Sending streaming text request');

    const model = this.client.getGenerativeModel({
      model: this.generationModel,
      systemInstruction: systemPrompt,
    });

    const start = Date.now();
    try {
      const { stream, response } = await model.generateContentStream(userMessage);
      for await (const chunk of stream) {
        const text = chunk.text();
        if (text) yield text;
      }

      const finalResponse = await response;
      this.recordUsage(this.extractUsage(finalResponse.usageMetadata), Date.now() - start);
    } catch (err) {
      this.logger.error({ err }, GEMINI_ERRORS.API_CALL_FAILED);
      throw new InternalServerErrorException(GEMINI_ERRORS.API_CALL_FAILED, { cause: err });
    }
  }

  @Resilient()
  async generateEmbedding(text: string): Promise<number[]> {
    this.logger.info({ model: this.embeddingModel }, 'Generating embedding');
    const start = Date.now();
    try {
      const model = this.client.getGenerativeModel({ model: this.embeddingModel });
      const result = await model.embedContent({
        content: { role: 'user', parts: [{ text }] },
        outputDimensionality: 768,
      } as EmbedContentRequest);
      this.recordEmbeddingUsage(this.estimateTokens(text), Date.now() - start);
      return result.embedding.values;
    } catch (err) {
      this.logger.error({ err }, GEMINI_ERRORS.API_CALL_FAILED);
      throw new InternalServerErrorException(GEMINI_ERRORS.API_CALL_FAILED, { cause: err });
    }
  }

  private extractUsage(
    meta: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined,
  ): TokenUsage {
    if (!meta) return this.zeroUsage();
    return {
      promptTokens: meta.promptTokenCount ?? 0,
      completionTokens: meta.candidatesTokenCount ?? 0,
      totalTokens: meta.totalTokenCount ?? 0,
    };
  }

  private toGeminiSchema(prop: AiSchemaProperty): Schema {
    switch (prop.type) {
      case 'string':
        return { type: SchemaType.STRING } satisfies Schema;
      case 'number':
        return { type: SchemaType.NUMBER } satisfies Schema;
      case 'boolean':
        return { type: SchemaType.BOOLEAN } satisfies Schema;
      case 'array':
        return { type: SchemaType.ARRAY, items: this.toGeminiSchema(prop.items) } satisfies Schema;
      case 'object':
        return {
          type: SchemaType.OBJECT,
          properties: Object.fromEntries(Object.entries(prop.properties).map(([k, v]) => [k, this.toGeminiSchema(v)])),
          required: prop.required,
        } satisfies Schema;
    }
  }

  private extractThoughtSignature(response: EnhancedGenerateContentResponse, toolName: string): string | undefined {
    const parts = response.candidates?.[0]?.content?.parts as (Part & { thoughtSignature?: string })[] | undefined;
    return parts?.find((part) => part.functionCall?.name === toolName)?.thoughtSignature;
  }

  private toGeminiHistory(messages: AgentMessage[]): Content[] {
    return messages.map((msg): Content => {
      switch (msg.role) {
        case 'user':
          return { role: 'user', parts: [{ text: msg.text }] };
        case 'model':
          return { role: 'model', parts: [{ text: msg.text }] };
        case 'tool_call':
          return {
            role: 'model',
            parts: [
              {
                functionCall: { name: msg.toolName, args: msg.args },
                ...(msg.thoughtSignature ? { thoughtSignature: msg.thoughtSignature } : {}),
              } as Part,
            ],
          };
        case 'tool_result':
          return {
            role: 'function',
            parts: [{ functionResponse: { name: msg.toolName, response: { result: msg.result } } } satisfies Part],
          };
      }
    });
  }

  private toLastParts(message: AgentMessage): Part[] {
    if (message.role === 'user') {
      return [{ text: message.text }];
    }
    if (message.role === 'tool_result') {
      return [{ functionResponse: { name: message.toolName, response: { result: message.result } } } satisfies Part];
    }
    throw new InternalServerErrorException(
      `generateWithTools called with unexpected last message role: ${message.role}`,
    );
  }

  private parseJson(rawJson: string): unknown {
    try {
      return JSON.parse(rawJson) as unknown;
    } catch (err) {
      this.logger.error({ err, rawJson }, GEMINI_ERRORS.NON_JSON_RESPONSE);
      throw new InternalServerErrorException(GEMINI_ERRORS.NON_JSON_RESPONSE);
    }
  }

  private zeroUsage(): TokenUsage {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  private computeCostUsd(usage: TokenUsage): number {
    return (
      (usage.promptTokens * this.costInputPerMillion + usage.completionTokens * this.costOutputPerMillion) / 1_000_000
    );
  }

  private recordUsage(usage: TokenUsage, durationMs: number): void {
    const operation = this.usageContext.getOperation();
    if (!operation) return;

    void this.metricsReporter.record({
      operation,
      model: this.generationModel,
      usage,
      estimatedCostUsd: this.computeCostUsd(usage),
      durationMs,
    });
  }

  // embedContent's response doesn't expose token usage the way generateContent's does, so the
  // count here is an estimate (~4 chars/token), not a value read off the API response.
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private recordEmbeddingUsage(promptTokens: number, durationMs: number): void {
    const operation = this.usageContext.getOperation();
    if (!operation) return;

    const usage: TokenUsage = { promptTokens, completionTokens: 0, totalTokens: promptTokens };
    void this.metricsReporter.record({
      operation,
      model: this.embeddingModel,
      usage,
      estimatedCostUsd: (promptTokens * this.costEmbeddingPerMillion) / 1_000_000,
      durationMs,
    });
  }
}
