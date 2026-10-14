import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';

import { RecordActionRegistry } from '../records/record-action.registry';
import { TASK_COMPLETE_ACTION } from './task-complete.action';

/**
 * Registers the example application's custom actions with the generic records runtime.
 *
 * Keeping registration in a start-up hook means the action is available wherever the
 * module is loaded, and the records module never has to know the action exists.
 */
@Injectable()
export class ExampleProjectsBootstrap implements OnModuleInit {
  constructor(@Inject(RecordActionRegistry) private readonly actions: RecordActionRegistry) {}

  onModuleInit(): void {
    this.actions.register('task', 'complete', TASK_COMPLETE_ACTION);
  }
}
