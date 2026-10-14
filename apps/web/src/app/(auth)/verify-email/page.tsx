'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

import { AuthCard, useAuthForm } from '@/features/auth/auth-form';
import { verifyEmail } from '@/features/auth/auth-api';
import { FormErrorSummary, FormSubmitButton } from '@/components/ui/form-field';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const verificationToken = searchParams.get('token') ?? '';
  const { pending, errors, run } = useAuthForm();
  const [done, setDone] = useState(false);

  async function submit() {
    const ok = await run(() => verifyEmail({ verificationToken }));
    if (ok) {
      setDone(true);
    }
  }

  if (done || verificationToken === '') {
    return (
      <AuthCard
        title={verificationToken === '' ? 'Link invalid' : 'Email verified'}
        description={
          verificationToken === ''
            ? 'This verification link is missing its token.'
            : 'Your email address has been confirmed.'
        }
      >
        {verificationToken !== '' && (
          <p className="text-sm text-muted-foreground">You can now sign in and start using HRIS.</p>
        )}
        <Link href="/login" className="text-sm font-medium hover:underline">
          Go to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Verify your email"
      description="Confirm your email address to activate your account."
    >
      <div className="flex flex-col gap-4">
        {errors.summary !== undefined && <FormErrorSummary>{errors.summary}</FormErrorSummary>}
        <FormSubmitButton pending={pending} pendingText="Verifying…" onClick={() => void submit()}>
          Verify email
        </FormSubmitButton>
      </div>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthCard title="Verify your email" description="Loading…">
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        </AuthCard>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
