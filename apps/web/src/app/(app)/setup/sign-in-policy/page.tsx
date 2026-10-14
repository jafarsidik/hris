import type { Metadata } from 'next';

import { SettingsScreen } from '@/features/iam/settings-screen';

export const metadata: Metadata = { title: 'Sign In policy' };

export default function SignInPolicyPage() {
  return (
    <SettingsScreen
      group="security"
      title="Sign In policy"
      description="How users may authenticate: password, passkeys and enterprise sign-in."
    />
  );
}
