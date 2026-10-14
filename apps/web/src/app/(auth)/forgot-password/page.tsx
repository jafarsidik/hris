'use client';

import { useState } from 'react';

import { AuthCard, useAuthForm } from '@/features/auth/auth-form';
import { forgotPassword } from '@/features/auth/auth-api';
import { FormErrorSummary, FormField, FormSubmitButton } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const { pending, errors, run } = useAuthForm();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function submit() {
    const ok = await run(() => forgotPassword({ email }));
    if (ok) {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <AuthCard
        title="Check your inbox"
        description="If an account exists for that address, a reset link is on its way."
      >
        <p className="text-sm text-muted-foreground">
          The link is valid for a short time. If it does not arrive within a few minutes, check your
          spam folder and try again.
        </p>
        <Link href="/login" className="text-sm font-medium hover:underline">
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your work email and we will send you a reset link."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-4"
        noValidate
      >
        {errors.summary !== undefined && <FormErrorSummary>{errors.summary}</FormErrorSummary>}
        <FormField
          label="Email"
          htmlFor="forgot-email"
          required
          error={errors.fieldErrors.email}
          errorId="forgot-email-error"
        >
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            aria-invalid={errors.fieldErrors.email !== undefined}
            aria-describedby={
              errors.fieldErrors.email !== undefined ? 'forgot-email-error' : undefined
            }
            required
          />
        </FormField>
        <FormSubmitButton pending={pending} pendingText="Sending…">
          Send reset link
        </FormSubmitButton>
      </form>
      <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
        Back to sign in
      </Link>
    </AuthCard>
  );
}
