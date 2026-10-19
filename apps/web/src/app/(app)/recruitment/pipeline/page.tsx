import type { Metadata } from 'next';

import { RecruitmentPipelineScreen, getRecruitmentRepository } from '@/features/recruitment';

export const metadata: Metadata = { title: 'Recruitment' };

export default async function RecruitmentPipelinePage() {
  const repository = getRecruitmentRepository();
  const [requisitions, applications] = await Promise.all([
    repository.listRequisitions({}),
    repository.listApplications({}),
  ]);

  return (
    <RecruitmentPipelineScreen
      requisitions={requisitions.items}
      applications={applications.items}
    />
  );
}
