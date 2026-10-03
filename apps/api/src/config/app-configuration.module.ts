import { Global, Module } from '@nestjs/common';

import { parseConfiguration, type AppConfiguration } from './app-configuration';

/**
 * DI token for the validated {@link AppConfiguration} tree.
 *
 * Consumers inject this token instead of reaching into `ConfigService` string
 * keys, so a renamed environment variable is a compile-time error rather than
 * an undefined value discovered at runtime.
 */
export const APP_CONFIG = Symbol('APP_CONFIG');

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfiguration => parseConfiguration(),
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigurationModule {}
