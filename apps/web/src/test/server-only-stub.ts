/**
 * Stands in for the `server-only` package during tests.
 *
 * The real package throws on import unless the bundler resolved it under the
 * `react-server` condition, which only Next does. Its purpose is to make importing a
 * server module from a client component a build error, so an empty module is the correct
 * substitute here: it neutralises the guard without disabling it in the app build, where
 * the real package still applies.
 *
 * Aliasing this is what lets a server action be exercised in isolation. Without it, every
 * test of `getEmployeeRepository` would fail on an import guard rather than on behaviour.
 */
export {};
