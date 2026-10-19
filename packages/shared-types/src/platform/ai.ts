export interface AiKnowledgeDocumentSummary {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly source: string | null;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AiAskInput {
  readonly question: string;
  readonly limit?: number;
  /** When supplied, the agent's prompt, model and granted tools apply to the call. */
  readonly agentKey?: string;
}

export interface AiAskResponse {
  readonly answer: string;
  readonly sources: readonly {
    readonly id: string;
    readonly title: string;
    readonly score: number;
  }[];
  readonly latencyMs: number;
}

/** Effective provider configuration behind the AI Services -> Providers screen. */
export interface AiProviderSummary {
  /** Stable identifier of the configured backend (the single gateway provider). */
  readonly key: string;
  /** Human label derived from the provider kind, e.g. `openai-compatible`. */
  readonly name: string;
  readonly provider: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly timeoutMs: number;
  /** Whether the process-level (environment) configuration allows AI calls at all. */
  readonly envEnabled: boolean;
  /** Whether an API key is present. The key itself is never returned. */
  readonly apiKeyConfigured: boolean;
  /** Whether this tenant's `ai.enabled` setting turns the gateway on. */
  readonly companyEnabled: boolean;
  /** Where the configuration comes from; the gateway reads the environment today. */
  readonly source: 'environment';
}

/** One recorded model request, newest first (AI Services -> AI Logs). */
export interface AiCallSummary {
  readonly id: string;
  readonly feature: string;
  readonly provider: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
  readonly status: string;
  readonly createdAt: string;
}

export interface AiUsageBucket {
  readonly calls: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** USD; `null` while no pricing is configured for the bucket's model(s). */
  readonly estimatedCostUsd: number | null;
}

/** Aggregate over the most recent AI calls (AI Services -> Usage & Cost). */
export interface AiUsageSummary {
  readonly totals: AiUsageBucket;
  readonly byModel: readonly (AiUsageBucket & {
    readonly provider: string;
    readonly model: string;
  })[];
  readonly byDay: readonly (AiUsageBucket & { readonly day: string })[];
  readonly byFeature: readonly (AiUsageBucket & { readonly feature: string })[];
  /** Whether every observed model carries pricing; spend is partial otherwise. */
  readonly pricingConfigured: boolean;
  readonly sampledCalls: number;
  readonly sampledAt: string;
}

/** Catalogue entry behind AI Services -> Models. Prices are USD per 1M tokens. */
export interface AiModelSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly provider: string;
  readonly contextWindow: number | null;
  readonly inputPricePerMillion: number | null;
  readonly outputPricePerMillion: number | null;
  readonly isDefault: boolean;
  readonly isEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateAiModelInput {
  readonly key: string;
  readonly name: string;
  readonly provider?: string;
  readonly contextWindow?: number | null;
  readonly inputPricePerMillion?: number | null;
  readonly outputPricePerMillion?: number | null;
  readonly isDefault?: boolean;
  readonly isEnabled?: boolean;
}

export type UpdateAiModelInput = Partial<Omit<CreateAiModelInput, 'key'>>;

/** One version of a prompt template (AI Services -> Prompts). */
export interface AiPromptSummary {
  readonly id: string;
  readonly key: string;
  readonly version: number;
  readonly name: string | null;
  readonly content: string;
  readonly isEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateAiPromptInput {
  readonly key: string;
  readonly content: string;
  readonly name?: string | null;
  /** Omit to create the next version for the key; `1` starts the key. */
  readonly version?: number;
  readonly isEnabled?: boolean;
}

export type UpdateAiPromptInput = Partial<Omit<CreateAiPromptInput, 'key' | 'version'>> & {
  readonly version?: number;
};

/** An assistant definition (AI Services -> Agents). `tools` are built-in tool keys. */
export interface AiAgentSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly promptKey: string | null;
  readonly modelKey: string | null;
  readonly tools: readonly string[];
  readonly isEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateAiAgentInput {
  readonly key: string;
  readonly name: string;
  readonly description?: string | null;
  readonly promptKey?: string | null;
  readonly modelKey?: string | null;
  readonly tools?: readonly string[];
  readonly isEnabled?: boolean;
}

export type UpdateAiAgentInput = Partial<Omit<CreateAiAgentInput, 'key'>>;

/** A tool the assistant may use (AI Services -> Tools). */
export interface AiToolSummary {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly defaultEnabled: boolean;
  /** Effective availability after the tenant's override, if any. */
  readonly isEnabled: boolean;
  /** Whether a tenant override row exists (absence = built-in default). */
  readonly overridden: boolean;
  readonly overrideId: string | null;
}

/**
 * Tools the gateway can actually execute, shared by the API's gate and the console
 * screen so the two can never disagree about what exists. Extending the runtime with a
 * new callable means adding it here first.
 */
export const AI_BUILTIN_TOOLS: readonly AiToolSummary[] = [
  {
    key: 'knowledge.search',
    name: 'Knowledge search',
    description:
      'Retrieve published knowledge documents and ground the answer in them with citations.',
    defaultEnabled: true,
    isEnabled: true,
    overridden: false,
    overrideId: null,
  },
];
