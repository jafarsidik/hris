import { Inject, Injectable, Logger } from '@nestjs/common';

import { APP_CONFIG } from '../../config/app-configuration.module';
import type { AppConfiguration, AiConfig } from '../../config/app-configuration';

export interface AiMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface AiCompletionResult {
  readonly content: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * Provider-agnostic AI backend.
 *
 * Talks to an OpenAI-compatible chat/completion endpoint over `fetch`, so a self-hosted
 * gateway (Ollama, llama.cpp, Azure OpenAI via its OpenAI-compatible interface) works
 * with the same code path. When no key is configured (`disabled`), calls return null and
 * the gateway answers "unavailable" — nothing is ever sent to a provider accidentally.
 */
@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfiguration) {}

  get cfg(): AiConfig {
    return this.config.ai;
  }

  configured(): boolean {
    return this.cfg.enabled && typeof this.cfg.apiKey === 'string' && this.cfg.apiKey.trim() !== '';
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.cfg.apiKey as string}`,
    };
  }

  async complete(
    messages: readonly AiMessage[],
    options?: { maxTokens?: number; temperature?: number },
  ): Promise<AiCompletionResult | null> {
    if (!this.configured()) {
      return null;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const response = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model: this.cfg.model,
          messages,
          max_tokens: options?.maxTokens ?? 512,
          temperature: options?.temperature ?? 0.2,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        this.logger.warn(`AI completion failed: HTTP ${response.status}`);
        return null;
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        content: data.choices?.[0]?.message?.content?.trim() ?? '',
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      };
    } catch (err) {
      this.logger.warn(`AI completion threw: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async embed(texts: readonly string[]): Promise<number[][] | null> {
    if (!this.configured()) {
      return null;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const response = await fetch(`${this.cfg.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ model: this.cfg.model, input: texts }),
        signal: controller.signal,
      });
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
      return data.data?.map((row) => row.embedding ?? []) ?? null;
    } catch (err) {
      this.logger.warn(`AI embed threw: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
