import { mockOffboardingRepository } from './mock-offboarding-repository';
import { OffboardingScreen } from './offboarding-screen';

export function getOffboardingRepository() {
  return mockOffboardingRepository;
}

export { OffboardingScreen };

export type { OffboardingCase, OffboardingCasePage } from './offboarding-types';
