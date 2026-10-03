import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import {
  toNestLogLevel,
  WILDCARD_HOST,
  type AppConfiguration,
} from './config/app-configuration';
import { APP_CONFIG } from './config/app-configuration.module';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const config = app.get<AppConfiguration>(APP_CONFIG);
  app.useLogger(toNestLogLevel(config.logging.level));

  const logger = new Logger('Bootstrap');
  logger.log(`Starting HRIS API in "${config.environment}" mode`);

  configureApp(app, config);

  if (config.swagger.enabled) {
    logger.log(`OpenAPI documentation available at ${config.swagger.path}`);
  }

  app.enableShutdownHooks();

  // An unspecified host makes Node bind a dual-stack socket, so the wildcard is
  // translated away rather than passed through. Passing "0.0.0.0" verbatim would
  // produce an IPv4-only listener and drop IPv6 clients, and the previous default
  // of "localhost" produced an IPv6-loopback-only listener that no IPv4 client
  // could reach. Any other value is an explicit interface and is honoured as-is.
  const bindHost = config.http.host === WILDCARD_HOST ? undefined : config.http.host;

  // The two-argument overload cannot accept an explicit undefined: Nest's overload
  // set would resolve it against the callback parameter instead.
  if (bindHost === undefined) {
    await app.listen(config.http.port);
  } else {
    await app.listen(config.http.port, bindHost);
  }

  logger.log(
    `HRIS API listening on port ${config.http.port} ` +
      `(bound to ${bindHost ?? 'all interfaces, dual-stack'})`,
  );
}

void bootstrap().catch((error: unknown) => {
  // The Nest logger is not guaranteed to be configured yet, so a boot failure
  // is reported directly on stderr to guarantee it is never swallowed.
  process.stderr.write(
    `Failed to start the HRIS API: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});