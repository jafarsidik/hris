import type { Metadata } from 'next';

import { OffboardingScreen, getOffboardingRepository } from '@/features/offboarding';

export const metadata: Metadata = { title: 'Offboarding' };

export default async function OffboardingPage() {
  const repository = getOffboardingRepository();
  const cases = await repository.listCases({});

  return <OffboardingScreen rows={cases.items} />;
}
