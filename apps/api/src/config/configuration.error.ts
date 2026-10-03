/**
 * Boot-time configuration failure.
 *
 * The API must refuse to start with an invalid environment rather than
 * silently defaulting, so this error aggregates every problem found during
 * parsing instead of reporting only the first one.
 */
export class ConfigurationError extends Error {
  public readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid application configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigurationError';
    this.problems = problems;
  }
}
