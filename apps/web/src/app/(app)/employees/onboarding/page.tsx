import { OnboardingScreen } from '@/features/employees/onboarding-screen';
import { computeOnboardingPipeline } from '@/features/employees/onboarding-pipeline';
import { getEmployeeRepository } from '@/features/employees';
import { MAX_PAGE_SIZE } from '@hris/shared-types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Onboarding' };

export default async function OnboardingPage() {
  const page = await getEmployeeRepository().list({
    status: 'ALL',
    department: 'ALL',
    employmentType: 'ALL',
    sort: 'name',
    page: { limit: MAX_PAGE_SIZE },
  });

  const pipeline = computeOnboardingPipeline(page.items);

  return (
    <OnboardingScreen
      rows={pipeline.rows}
      startingThisMonth={pipeline.startingThisMonth}
      confirmationsDue30Days={pipeline.confirmationsDue30Days}
    />
  );
}
