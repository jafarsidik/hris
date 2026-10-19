'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';

import type { AiAskResponse, AiKnowledgeDocumentSummary } from '@hris/shared-types';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/feedback/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

import { useCan, useSession } from '@/features/auth/session-context';
import { useIamLoad } from '@/features/iam/use-iam-data';
import { aiApi } from '@/features/ai/ai-api';
import { ApiRequestError } from '@/lib/api/http-client';

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.details?.[0]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not complete the request.';
}

export function AiAssistantScreen() {
  const router = useRouter();
  const { state } = useSession();
  const canManage = useCan('ai.create');
  const canAsk = useCan('ai.view');
  const docs = useIamLoad(() => aiApi.listDocuments(), []);

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AiAskResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Add doc form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [notice, setNotice] = useState<string | undefined>();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  useEffect(() => {
    aiApi
      .status()
      .then((result) => setEnabled(result.enabled))
      .catch(() => setEnabled(false));
  }, []);

  const ask = useCallback(async () => {
    if (question.trim() === '') {
      return;
    }
    setError(undefined);
    setAnswer(null);
    setBusy(true);
    try {
      const response = await aiApi.ask(question, 5);
      setAnswer(response);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [question]);

  const addDocument = useCallback(async () => {
    setError(undefined);
    setNotice(undefined);
    setBusy(true);
    try {
      await aiApi.addDocument({ title, content });
      setNotice('Document added to the knowledge base.');
      setTitle('');
      setContent('');
      setShowForm(false);
      docs.reload();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }, [title, content, docs]);

  const removeDocument = useCallback(
    async (id: string) => {
      await aiApi.removeDocument(id);
      docs.reload();
    },
    [docs],
  );

  const docRows = docs.data ?? [];

  return (
    <PageBody>
      <PageHeader
        title="AI Assistant"
        description="Ask questions against published policy documents. AI is disabled by default; enable AI_ENABLED and the `ai.enabled` company setting."
      />
      {enabled === false && (
        <Alert>
          <AlertDescription>
            AI is disabled. Set AI_ENABLED=true and enable `ai.enabled` for this company to use
            these features.
          </AlertDescription>
        </Alert>
      )}
      {error !== undefined && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice !== undefined && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ask the assistant</CardTitle>
            <CardDescription>
              Answers cite the policy documents above. No personal employee data leaves the
              platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What is our leave policy?"
                disabled={!canAsk || busy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void ask();
                  }
                }}
              />
              <Button
                onClick={() => void ask()}
                disabled={!canAsk || busy || question.trim() === ''}
              >
                <Send className="mr-1 size-4" />
                Ask
              </Button>
            </div>
            {answer !== null && (
              <div className="flex flex-col gap-2">
                <p className="text-sm whitespace-pre-wrap">{answer.answer}</p>
                {answer.sources.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Sources:
                    <ul className="list-disc pl-5">
                      {answer.sources.map((source) => (
                        <li key={source.id}>
                          {source.title} ({Math.round(source.score * 100)}%)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{answer.latencyMs} ms</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Knowledge documents</CardTitle>
                <CardDescription>
                  Published policy text. ({docRows.length} document{docRows.length === 1 ? '' : 's'}
                  )
                </CardDescription>
              </div>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
                  {showForm ? 'Hide' : 'Add document'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {docs.loading ? (
              <Skeleton className="h-24 w-full" />
            ) : docRows.length === 0 ? (
              <EmptyState title="No published documents" />
            ) : (
              <ul className="flex flex-col gap-2">
                {docRows.map((doc: AiKnowledgeDocumentSummary) => (
                  <li
                    key={doc.id}
                    className="flex items-start justify-between gap-2 border rounded-md p-3"
                  >
                    <div>
                      <p className="font-medium text-sm">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.kind} · {doc.source ?? 'no source'} · {doc.status}
                      </p>
                    </div>
                    {canManage && (
                      <Button variant="ghost" size="sm" onClick={() => void removeDocument(doc.id)}>
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {showForm && (
              <div className="flex flex-col gap-3 border-t pt-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-title">Title</Label>
                  <Input id="ai-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-content">Content (published policy text)</Label>
                  <Textarea
                    id="ai-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    className="text-sm"
                  />
                </div>
                <Button
                  onClick={() => void addDocument()}
                  disabled={busy || title.trim() === '' || content.trim() === ''}
                >
                  {busy ? 'Saving…' : 'Add to knowledge base'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageBody>
  );
}
