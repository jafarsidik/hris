import { Injectable } from '@nestjs/common';

import { NotFoundError } from '../../common/errors/app-error';
import type { RecordActionDefinition } from './record-action.types';

/**
 * The registry of custom record actions.
 *
 * Business modules register their handlers at start-up keyed by `resource.action`; the
 * generic records runtime looks them up when a request names an action in the URL. Core
 * knows only this interface, so a domain can add an action without the records module
 * importing it — the same inversion the metadata registry uses for resources.
 */
@Injectable()
export class RecordActionRegistry {
  private readonly actions = new Map<string, RecordActionDefinition>();

  /** Registers a handler. Re-registering the same action replaces it (idempotent start-up). */
  register(resourceKey: string, action: string, definition: RecordActionDefinition): void {
    this.actions.set(key(resourceKey, action), definition);
  }

  /** The handler for a resource/action pair, or null. */
  find(resourceKey: string, action: string): RecordActionDefinition | null {
    return this.actions.get(key(resourceKey, action)) ?? null;
  }

  /** Like {@link find} but raises the error the HTTP layer should surface. */
  require(resourceKey: string, action: string): RecordActionDefinition {
    const definition = this.find(resourceKey, action);
    if (definition === null) {
      throw new NotFoundError(`The resource "${resourceKey}" has no action "${action}".`);
    }
    return definition;
  }

  /** The actions registered for a resource, for diagnostics and tests. */
  actionsFor(resourceKey: string): readonly string[] {
    const prefix = `${resourceKey}.`;
    return [...this.actions.keys()]
      .filter((entry) => entry.startsWith(prefix))
      .map((entry) => entry.slice(prefix.length))
      .sort();
  }
}

function key(resourceKey: string, action: string): string {
  return `${resourceKey}.${action}`;
}
