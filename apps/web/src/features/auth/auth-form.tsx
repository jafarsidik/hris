'use client';

import { useCallback, useState, type ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiRequestError } from '@/lib/api/http-client';

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

export interface FormErrors {
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly summary?: string;
}

const fieldErrorExtractors: readonly (readonly string[])[] = [
  ['email'],
  ['password'],
  ['currentPassword'],
  ['newPassword'],
  ['resetToken'],
  ['verificationToken'],
  ['displayName'],
];

/**
 * Runs a client-side form action and normalises `ApiRequestError`s into per-field
 * errors plus an optional form-level summary. Field errors come from the API
 * validate-details (the platform contract), matched by their `field` name.
 */
export function useAuthForm() {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({ fieldErrors: {} });

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setPending(true);
    setErrors({ fieldErrors: {} });
    try {
      await action();
      return true;
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const fieldErrors: Record<string, string> = {};
        for (const detail of error.details ?? []) {
          const matched = fieldErrorExtractors.find((group) => group.includes(detail.field));
          const field = matched?.[0];
          if (field !== undefined) {
            fieldErrors[field] = detail.message;
          }
        }
        setErrors({
          fieldErrors,
          summary: Object.keys(fieldErrors).length > 0 ? undefined : error.message,
        });
      } else {
        setErrors({
          fieldErrors: {},
          summary: 'An unexpected error occurred. Please try again.',
        });
      }
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  return { pending, errors, run };
}
