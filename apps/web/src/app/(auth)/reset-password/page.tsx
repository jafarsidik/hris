'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

import { AuthCard, useAuthForm } from '@/features/auth/auth-form';
import { resetPassword } from '@/features/auth/auth-api';
import { FormErrorSummary, FormField, FormSubmitButton } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const resetToken = searchParams.get('token') ?? '';
  const { pending, errors, run } = useAuthForm();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);

  async function submit() {
    if (password !== confirm) {
      return;
    }
    const ok = await run(() => resetPassword({ resetToken, password }));
    if (ok) {
      setDone(true);
    }
  }

  if (done) {
    return (
      <AuthCard title="Password updated" description="Your password has been changed.">
        <p className="text-sm text-muted-foreground">You can now sign in with your new password.</p>
        <Link href="/login" className="text-sm font-medium hover:underline">
          Go to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" description="Set a new password for your account.">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-4"
        noValidate
      >
        {errors.summary !== undefined && <FormErrorSummary>{errors.summary}</FormErrorSummary>}
        {password !== confirm && <FormErrorSummary>Passwords do not match.</FormErrorSummary>}
        <FormField
          label="New password"
          htmlFor="reset-password"
          required
          error={errors.fieldErrors.password}
          errorId="reset-password-error"
        >
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            aria-invalid={errors.fieldErrors.password !== undefined}
            aria-describedby={
              errors.fieldErrors.password !== undefined ? 'reset-password-error' : undefined
            }
            required
          />
        </FormField>
        <FormField
          label="Confirm new password"
          htmlFor="reset-password-confirm"
          required
          error={errors.fieldErrors.newPassword}
          errorId="reset-password-confirm-error"
        >
          <Input
            id="reset-password-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.currentTarget.value)}
            aria-invalid={errors.fieldErrors.newPassword !== undefined}
            aria-describedby={
              errors.fieldErrors.newPassword !== undefined
                ? 'reset-password-confirm-error'
                : undefined
            }
            required
          />
        </FormField>
        <FormSubmitButton pending={pending} pendingText="Updating…">
          Update password
        </FormSubmitButton>
      </form>
      <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
        Back to sign in
      </Link>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthCard title="Reset your password" description="Loading…">
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        </AuthCard>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
