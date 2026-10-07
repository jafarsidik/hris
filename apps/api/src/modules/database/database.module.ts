import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Exposes the Prisma client to the whole application.
 *
 * Global because the tenant context in `@hris/database` is a hard requirement for any
 * query, so every business module will need this client. Making it global avoids each
 * module having to import this one, and the alternative — a repository layer that hides
 * the client — would obscure that tenant scoping is the caller's responsibility.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
