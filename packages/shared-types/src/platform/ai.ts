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
