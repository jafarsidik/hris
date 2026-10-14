import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AppConfigurationModule } from './config/app-configuration.module';
import { AuthInfraModule } from './common/auth/auth-infra.module';
import { AuthenticationGuard } from './common/auth/auth.guard';
import { AuthorizationGuard } from './common/auth/authorization.guard';
import { CsrfGuard } from './common/auth/csrf.guard';
import { CryptoModule } from './common/crypto/crypto.module';
import { AccessModule } from './modules/access/access.module';
import { ApiClientsModule } from './modules/api-clients/api-clients.module';
import { ApprovalModule } from './modules/approvals/approval.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './modules/database/database.module';
import { ExampleProjectsModule } from './modules/example-projects/example-projects.module';
import { HealthModule } from './modules/health/health.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { LogModule } from './modules/logs/log.module';
import { MfaModule } from './modules/mfa/mfa.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { PasskeyModule } from './modules/passkeys/passkey.module';
import { QueueModule } from './modules/queue/queue.module';
import { RecordsModule } from './modules/records/records.module';
import { RedisModule } from './modules/redis/redis.module';
import { RegistryModule } from './modules/registry/registry.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SsoModule } from './modules/sso/sso.module';
import { WorkflowModule } from './modules/workflows/workflow.module';

/**
 * Root module.
 *
 * Business modules are added as their phase is implemented; each one owns its own
 * persistence, authorization and audit concerns. Authentication and authorization
 * are HTTP-wide concerns and are applied here as global guards, in order:
 *
 *   1. `CsrfGuard`            - refuse cross-site state changes early.
 *   2. `AuthenticationGuard`  - resolve the caller from the session token (ADR 0010).
 *   3. `AuthorizationGuard`   - enforce every route's `RequirePermission`.
 *
 * `AuthInfraModule` is global so the guards (which run app-wide by definition) can
 * depend on the session store and principal resolution without importing anything.
 *
 * Note: remaining HTTP-wide concerns (security headers, CORS, versioning,
 * validation, error handling, correlation ids) are applied in `configureApp`, not
 * here, so that production and end-to-end tests share one wiring.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Values already present in the real environment always win, so a
      // checked-in development `.env` can never override container or CI
      // configuration.
      envFilePath: ['.env', '../../.env'],
      cache: true,
    }),
    AppConfigurationModule,
    DatabaseModule,
    RedisModule,
    QueueModule,
    AuthInfraModule,
    CryptoModule,
    AuthModule,
    AccessModule,
    ApiClientsModule,
    ApprovalModule,
    WorkflowModule,
    IntegrationsModule,
    ExampleProjectsModule,
    MfaModule,
    SsoModule,
    PasskeyModule,
    SettingsModule,
    NotificationModule,
    LogModule,
    RegistryModule,
    RecordsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
})
export class AppModule {}
