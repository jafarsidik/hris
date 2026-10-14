'use client';

import { useState } from 'react';

import { AuthCard, useAuthForm } from '@/features/auth/auth-form';
import { login } from '@/features/auth/auth-api';
import { FormErrorSummary, FormField, FormSubmitButton } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { pending, errors, run } = useAuthForm();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function submit() {
    void run(async () => {
      await login({ email, password });
      // The session cookie is now set; the app shell hydrates `auth/me` on arrival.
      router.replace('/');
    });
  }

  return (
    <AuthCard title="Sign in" description="Access your HRIS workspace with your work account.">
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
          htmlFor="login-email"
          required
          error={errors.fieldErrors.email}
          errorId="login-email-error"
        >
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            aria-invalid={errors.fieldErrors.email !== undefined}
            aria-describedby={
              errors.fieldErrors.email !== undefined ? 'login-email-error' : undefined
            }
            required
          />
        </FormField>
        <FormField
          label="Password"
          htmlFor="login-password"
          required
          error={errors.fieldErrors.password}
          errorId="login-password-error"
        >
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            aria-invalid={errors.fieldErrors.password !== undefined}
            aria-describedby={
              errors.fieldErrors.password !== undefined ? 'login-password-error' : undefined
            }
            required
          />
        </FormField>
        <FormSubmitButton pending={pending} pendingText="Signing in…">
          Sign in
        </FormSubmitButton>
      </form>
      <div className="flex flex-col gap-1 text-sm">
        <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">
          Forgot your password?
        </Link>
      </div>
    </AuthCard>
  );
}
