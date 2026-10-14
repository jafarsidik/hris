import { ConflictError } from '../../common/errors/app-error';
import type { RecordActionDefinition } from '../records/record-action.types';

/**
 * The domain-specific behaviour of the example application.
 *
 * This is the *only* code the Projects application adds: a completion rule and the fact
 * it emits. It reuses the standard `task.update` grant (a custom action is registered
 * metadata, not an `Action` enum member) and flows through the generic records runtime,
 * so the core never imports this file.
 */
export const TASK_COMPLETE_ACTION: RecordActionDefinition = {
  permission: 'task.update',
  async handle(context) {
    if (context.record.data['status'] === 'done') {
      throw new ConflictError('This task is already done.');
    }
    const title = context.record.data['title'];
    return {
      patch: { status: 'done', completedAt: new Date().toISOString() },
      events: [
        {
          type: 'task.completed',
          payload: { title: typeof title === 'string' ? title : null },
        },
      ],
      result: { status: 'done' },
    };
  },
};
