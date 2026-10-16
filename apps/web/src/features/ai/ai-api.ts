import type { AiAskResponse, AiKnowledgeDocumentSummary } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export const aiApi = {
  status: () => apiRequestV1<{ enabled: boolean }>('/ai/status'),
  listDocuments: () => apiRequestV1<readonly AiKnowledgeDocumentSummary[]>('/ai/knowledge'),
  addDocument: (input: { title: string; kind?: string; source?: string | null; content: string }) =>
    apiRequestV1('/ai/knowledge', { method: 'POST', body: input }),
  removeDocument: (id: string) =>
    apiRequestV1<never>(`/ai/knowledge/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  ask: (question: string, limit?: number) =>
    apiRequestV1<AiAskResponse>('/ai/ask', { method: 'POST', body: { question, limit } }),
};
