import {
  EMPLOYEE_LIFECYCLE_STAGES,
  EMPLOYEE_LIFECYCLE_TRANSITIONS,
  canTransitionEmployee,
  isEmployeeLifecycleStage,
} from '../src';

describe('employee lifecycle state machine', () => {
  it('declares a transition entry for every stage', () => {
    for (const stage of EMPLOYEE_LIFECYCLE_STAGES) {
      expect(EMPLOYEE_LIFECYCLE_TRANSITIONS[stage]).toBeDefined();
    }
  });

  it('never transitions out of ALUMNI', () => {
    expect(EMPLOYEE_LIFECYCLE_TRANSITIONS.ALUMNI).toEqual([]);
    expect(canTransitionEmployee('ALUMNI', 'ACTIVE')).toBe(false);
  });

  it('allows the documented happy path', () => {
    expect(canTransitionEmployee('RECRUITMENT', 'PRE_EMPLOYMENT')).toBe(true);
    expect(canTransitionEmployee('PRE_EMPLOYMENT', 'ONBOARDING')).toBe(true);
    expect(canTransitionEmployee('ONBOARDING', 'ACTIVE')).toBe(true);
    expect(canTransitionEmployee('ACTIVE', 'PROMOTION')).toBe(true);
    expect(canTransitionEmployee('PROMOTION', 'ACTIVE')).toBe(true);
    expect(canTransitionEmployee('RESIGNATION', 'OFFBOARDING')).toBe(true);
    expect(canTransitionEmployee('OFFBOARDING', 'ALUMNI')).toBe(true);
  });

  it('rejects skipping from recruitment straight to active', () => {
    expect(canTransitionEmployee('RECRUITMENT', 'ACTIVE')).toBe(false);
  });

  it('rejects reviving a terminated employee who has already left', () => {
    expect(canTransitionEmployee('TERMINATION', 'ACTIVE')).toBe(false);
    expect(canTransitionEmployee('OFFBOARDING', 'ACTIVE')).toBe(false);
  });

  it('rejects resuming a suspended employee directly into employment events', () => {
    expect(canTransitionEmployee('SUSPENSION', 'PROMOTION')).toBe(false);
    expect(canTransitionEmployee('SUSPENSION', 'ACTIVE')).toBe(true);
  });

  it('never declares an implicit self-transition', () => {
    for (const stage of EMPLOYEE_LIFECYCLE_STAGES) {
      expect(EMPLOYEE_LIFECYCLE_TRANSITIONS[stage]).not.toContain(stage);
    }
  });

  it('guards against untrusted lifecycle input', () => {
    expect(isEmployeeLifecycleStage('ACTIVE')).toBe(true);
    expect(isEmployeeLifecycleStage('active')).toBe(false);
    expect(isEmployeeLifecycleStage('RESIGNED')).toBe(false);
    expect(isEmployeeLifecycleStage(7)).toBe(false);
  });
});
