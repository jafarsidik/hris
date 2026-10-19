import { mockRecruitmentRepository } from './mock-recruitment-repository';
import { RecruitmentPipelineScreen } from './recruitment-pipeline-screen';

export function getRecruitmentRepository() {
  return mockRecruitmentRepository;
}

export { RecruitmentPipelineScreen };

export type {
  ApplicationPage,
  JobApplication,
  JobApplicationQuery,
  JobRequisition,
  RequisitionPage,
  RecruitmentRepository,
} from './recruitment-types';
