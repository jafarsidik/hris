import helmet from 'helmet';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CorrelationIdMiddleware } from './common/http/correlation-id.middleware';
import { AccessLogInterceptor } from './common/interceptors/access-log.interceptor';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import type { AppConfiguration } from './config/app-configuration';

/**
 * Applies the platform-wide HTTP configuration to a Nest application.
 *
 * This is the single source of truth for cross-cutting concerns: security
 * headers, CORS, versioning, validation, error handling and API documentation.
 * Both the production entrypoint (`main.ts`) and the end-to-end tests call it,
 * so a test can never pass against a wiring that production does not use.
 */
export function configureApp(app: INestApplication, config: AppConfiguration): void {
  app.use(helmet());

  app.enableCors({
    origin: [...config.http.corsOrigins],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id', 'X-Request-Id'],
    exposedHeaders: ['X-Correlation-Id'],
    maxAge: 600,
  });

  // Registered as an Express handler rather than through `NestModule.configure`
  // so it also covers routes excluded from the global prefix, and so the class
  // is instantiated exactly once here instead of being invoked as a bare
  // function reference.
  const correlationId = new CorrelationIdMiddleware();
  app.use(correlationId.use.bind(correlationId));

  app.setGlobalPrefix(config.http.globalPrefix, {
    // Health probes stay reachable at a stable, unprefixed URL.
    exclude: [...config.http.healthExclusions],
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: config.http.defaultVersion,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Unknown properties are rejected rather than silently dropped: a client
      // that sends `entityId` expecting it to be honoured must fail loudly
      // instead of having the field quietly ignored.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      // Report every violation at once instead of one per round trip.
      stopAtFirstError: false,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // Order matters: the access log records the final status code produced by the
  // response envelope and by the exception filter.
  app.useGlobalInterceptors(new AccessLogInterceptor());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor(new Reflector()));

  if (config.http.trustProxyHops > 0) {
    const expressInstance = app.getHttpAdapter().getInstance() as {
      set: (key: string, value: number) => void;
    };
    expressInstance.set('trust proxy', config.http.trustProxyHops);
  }

  if (config.swagger.enabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('HRIS API')
        .setDescription(
          'Enterprise HRIS REST API. Authorization for entity-sensitive resources is enforced server-side.',
        )
        .setVersion(config.http.defaultVersion)
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
        .build(),
    );
    SwaggerModule.setup(config.swagger.path, app, document, {
      swaggerOptions: { persistAuthorization: false },
    });
  }
}
