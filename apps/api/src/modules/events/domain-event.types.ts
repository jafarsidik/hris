/**
 * Domain event contracts.
 *
 * A domain event is the fact that something happened in a tenant's data — a task
 * completed, a record approved. Producers (custom record actions, business services)
 * describe the fact; consumers (subscribers registered at module start-up) react to it.
 * The bus is deliberately small and transport-agnostic: today it dispatches in-process,
 * so a consumer's side effect is observable in the request that caused it.
 */

/** A fact emitted after a state change has been committed. */
export interface DomainEvent<TPayload = Record<string, unknown>> {
  /** A stable, dot-separated name such as `task.completed`. */
  readonly type: string;
  readonly companyId: string;
  readonly actorUserId: string | null;
  /** The resource the fact concerns, e.g. `task`. */
  readonly resource: string;
  readonly resourceId: string;
  readonly payload: TPayload;
  readonly occurredAt: Date;
}

export type DomainEventHandler<TPayload = Record<string, unknown>> = (
  event: DomainEvent<TPayload>,
) => void | Promise<void>;

/** The minimal event shape a producer supplies; the bus fills in the envelope. */
export interface DomainEventInput<TPayload = Record<string, unknown>> {
  readonly type: string;
  readonly payload?: TPayload;
}
