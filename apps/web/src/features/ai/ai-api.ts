import type {
  AiAgentSummary,
  AiAskResponse,
  AiCallSummary,
  AiKnowledgeDocumentSummary,
  AiModelSummary,
  AiPromptSummary,
  AiProviderSummary,
  AiToolSummary,
  AiUsageSummary,
  CreateAiAgentInput,
  CreateAiModelInput,
  CreateAiPromptInput,
  UpdateAiAgentInput,
  UpdateAiModelInput,
  UpdateAiPromptInput,
} from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export const aiApi = {
  status: () => apiRequestV1<{ enabled: boolean }>('/ai/status'),
  listDocuments: () => apiRequestV1<readonly AiKnowledgeDocumentSummary[]>('/ai/knowledge'),
  addDocument: (input: { title: string; kind?: string; source?: string | null; content: string }) =>
    apiRequestV1('/ai/knowledge', { method: 'POST', body: input }),
  removeDocument: (id: string) =>
    apiRequestV1<never>(`/ai/knowledge/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  ask: (question: string, limit?: number, agentKey?: string) =>
    apiRequestV1<AiAskResponse>('/ai/ask', {
      method: 'POST',
      body: { question, limit, ...(agentKey === undefined ? {} : { agentKey }) },
    }),

  // Providers, logs and usage ------------------------------------------------
  providers: () => apiRequestV1<readonly AiProviderSummary[]>('/ai/providers'),
  calls: (options: { limit?: number; status?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.status !== undefined) params.set('status', options.status);
    const query = params.toString();
    return apiRequestV1<readonly AiCallSummary[]>(`/ai/calls${query === '' ? '' : `?${query}`}`);
  },
  usage: () => apiRequestV1<AiUsageSummary>('/ai/usage'),

  // Models --------------------------------------------------------------------
  listModels: () => apiRequestV1<readonly AiModelSummary[]>('/ai/models'),
  createModel: (input: CreateAiModelInput) =>
    apiRequestV1<AiModelSummary>('/ai/models', { method: 'POST', body: input }),
  updateModel: (id: string, input: UpdateAiModelInput) =>
    apiRequestV1<AiModelSummary>(`/ai/models/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: input,
    }),
  removeModel: (id: string) =>
    apiRequestV1<never>(`/ai/models/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Prompts -------------------------------------------------------------------
  listPrompts: () => apiRequestV1<readonly AiPromptSummary[]>('/ai/prompts'),
  createPrompt: (input: CreateAiPromptInput) =>
    apiRequestV1<AiPromptSummary>('/ai/prompts', { method: 'POST', body: input }),
  updatePrompt: (id: string, input: UpdateAiPromptInput) =>
    apiRequestV1<AiPromptSummary>(`/ai/prompts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: input,
    }),
  removePrompt: (id: string) =>
    apiRequestV1<never>(`/ai/prompts/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Agents --------------------------------------------------------------------
  listAgents: () => apiRequestV1<readonly AiAgentSummary[]>('/ai/agents'),
  createAgent: (input: CreateAiAgentInput) =>
    apiRequestV1<AiAgentSummary>('/ai/agents', { method: 'POST', body: input }),
  updateAgent: (id: string, input: UpdateAiAgentInput) =>
    apiRequestV1<AiAgentSummary>(`/ai/agents/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: input,
    }),
  removeAgent: (id: string) =>
    apiRequestV1<never>(`/ai/agents/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Tools ---------------------------------------------------------------------
  listTools: () => apiRequestV1<readonly AiToolSummary[]>('/ai/tools'),
  setTool: (key: string, enabled: boolean) =>
    apiRequestV1<AiToolSummary>(`/ai/tools/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: { enabled },
    }),
  resetTool: (key: string) =>
    apiRequestV1<AiToolSummary>(`/ai/tools/${encodeURIComponent(key)}`, { method: 'DELETE' }),
};
