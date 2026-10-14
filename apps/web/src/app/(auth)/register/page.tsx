'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

import { AuthCard, useAuthForm } from '@/features/auth/auth-form';
import { register } from '@/features/auth/auth-api';
import { FormErrorSummary, FormField, FormSubmitButton } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite') ?? '';
  const { pending, errors, run } = useAuthForm();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  async function submit() {
    if (password !== confirm) {
      return;
    }
    const ok = await run(() => register({ inviteToken, password }));
    if (ok) {
      router.replace('/');
    }
  }

  return (
    <AuthCard
      title="Set up your account"
      description="Complete your registration to join the workspace."
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
        {inviteToken === '' && (
          <FormErrorSummary>This link is missing its invitation token.</FormErrorSummary>
        )}
        {password !== confirm && <FormErrorSummary>Passwords do not match.</FormErrorSummary>}
        <FormField
          label="Password"
          htmlFor="register-password"
          required
          error={errors.fieldErrors.password}
          errorId="register-password-error"
        >
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            aria-invalid={errors.fieldErrors.password !== undefined}
            aria-describedby={
              errors.fieldErrors.password !== undefined ? 'register-password-error' : undefined
            }
            required
          />
        </FormField>
        <FormField
          label="Confirm password"
          htmlFor="register-password-confirm"
          required
          error={errors.fieldErrors.newPassword}
          errorId="register-password-confirm-error"
        >
          <Input
            id="register-password-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.currentTarget.value)}
            aria-invalid={errors.fieldErrors.newPassword !== undefined}
            aria-describedby={
              errors.fieldErrors.newPassword !== undefined
                ? 'register-password-confirm-error'
                : undefined
            }
            required
          />
        </FormField>
        <FormSubmitButton pending={pending} pendingText="Creating your account…">
          Create account
        </FormSubmitButton>
      </form>
      <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
        Already have an account? Sign in
      </Link>
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthCard title="Set up your account" description="Loading…">
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        </AuthCard>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
