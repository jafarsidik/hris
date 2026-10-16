import {
  NOTIFICATION_EMAIL_EVENTS,
  NOTIFICATION_EVENT_KINDS,
  NOTIFICATION_TEMPLATE_DEFAULTS,
  QUEUE_WORKFLOW,
  WORKFLOW_SLA_JOB,
  WORKFLOW_SLA_KINDS,
  WORKFLOW_TASK_DECISIONS,
  WORKFLOW_TASK_STATUSES,
  renderNotificationMessage,
  substitute,
} from '../src';

describe('workflow notifications vocabulary', () => {
  describe('substitute', () => {
    it('replaces every known placeholder', () => {
      expect(
        substitute('Hello {{name}}, step "{{step}}" is due', { name: 'Ada', step: 'HR' }),
      ).toBe('Hello Ada, step "HR" is due');
    });

    it('leaves placeholder-free templates untouched', () => {
      expect(substitute('No placeholders here', { detail: 'x' })).toBe('No placeholders here');
    });

    it('leaves unknown placeholders intact so gaps stay visible', () => {
      expect(substitute('Hello {{missing}}', { detail: 'x' })).toBe('Hello {{missing}}');
    });
  });

  describe('renderNotificationMessage', () => {
    it('renders an escalation message from the shared defaults', () => {
      const template = NOTIFICATION_TEMPLATE_DEFAULTS['workflow.task_escalated'].IN_APP;
      const message = renderNotificationMessage('workflow.task_escalated', 'IN_APP', template, {
        detail: 'Step "Manager" is overdue.',
      });
      expect(message.title).toBe('Task escalated');
      expect(message.description).toBe('Step "Manager" is overdue.');
    });

    it('substitutes the app URL into the email template', () => {
      const template = NOTIFICATION_TEMPLATE_DEFAULTS['workflow.task_escalated'].EMAIL;
      const message = renderNotificationMessage('workflow.task_escalated', 'EMAIL', template, {
        detail: 'Overdue.',
        appUrl: 'https://hris.test',
      });
      expect(message.description).toContain('https://hris.test');
    });
  });

  describe('workflow notification catalogue', () => {
    it('classifies escalation and expiry as warnings', () => {
      expect(NOTIFICATION_EVENT_KINDS['workflow.task_escalated']).toBe('warning');
      expect(NOTIFICATION_EVENT_KINDS['workflow.task_expired']).toBe('warning');
    });

    it('offers every channel for the task lifecycle events', () => {
      for (const key of [
        'workflow.task_assigned',
        'workflow.task_claimed',
        'workflow.task_decided',
        'workflow.task_escalated',
        'workflow.task_expired',
      ] as const) {
        expect(NOTIFICATION_TEMPLATE_DEFAULTS[key].IN_APP.subjectTemplate.length).toBeGreaterThan(
          0,
        );
        expect(NOTIFICATION_TEMPLATE_DEFAULTS[key].EMAIL.subjectTemplate.length).toBeGreaterThan(0);
        expect(NOTIFICATION_TEMPLATE_DEFAULTS[key].PUSH.subjectTemplate.length).toBeGreaterThan(0);
      }
    });

    it('marks the task lifecycle events as email-eligible', () => {
      expect(NOTIFICATION_EMAIL_EVENTS.has('workflow.task_escalated')).toBe(true);
      expect(NOTIFICATION_EMAIL_EVENTS.has('workflow.task_expired')).toBe(true);
    });
  });

  describe('workflow task vocabulary', () => {
    it('exposes the decisions a task accepts', () => {
      expect(WORKFLOW_TASK_DECISIONS).toContain('APPROVE');
      expect(WORKFLOW_TASK_DECISIONS).toContain('REJECT');
    });

    it('covers the escalated and expired terminal states', () => {
      expect(WORKFLOW_TASK_STATUSES).toContain('ESCALATED');
      expect(WORKFLOW_TASK_STATUSES).toContain('EXPIRED');
    });
  });

  describe('SLA job contract', () => {
    it('pins the queue, job and kinds the API and worker share', () => {
      expect(QUEUE_WORKFLOW).toBe('hris.workflow');
      expect(WORKFLOW_SLA_JOB).toBe('workflow.sla');
      expect(WORKFLOW_SLA_KINDS).toEqual(['DUE', 'ESCALATION']);
    });
  });
});
