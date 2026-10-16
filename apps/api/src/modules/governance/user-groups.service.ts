import { Inject, Injectable } from '@nestjs/common';

import { withTenantContext } from '@hris/database';
import type { UserGroupMemberSummary, UserGroupSummary } from '@hris/shared-types';

import { NotFoundError } from '../../common/errors/app-error';
import { LogService } from '../logs/log.service';
import { PrismaService } from '../database/prisma.service';

interface UserActor {
  companyId: string;
  userId: string;
}

@Injectable()
export class UserGroupsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  async list(companyId: string): Promise<UserGroupSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await tx.userGroup.findMany({ orderBy: { name: 'asc' } });
      const groups = await Promise.all(
        rows.map(
          async (group: {
            id: string;
            name: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
          }) => {
            const count = await tx.userGroupMember.count({ where: { groupId: group.id } });
            return {
              id: group.id,
              name: group.name,
              description: group.description,
              memberCount: count,
              createdAt: group.createdAt.toISOString(),
              updatedAt: group.updatedAt.toISOString(),
            };
          },
        ),
      );
      return groups;
    });
  }

  async get(companyId: string, id: string): Promise<UserGroupSummary> {
    const all = await this.list(companyId);
    const found = all.find((g) => g.id === id);
    if (found === undefined) {
      throw new NotFoundError('The user group does not exist.');
    }
    return found;
  }

  async create(
    actor: UserActor,
    input: { name: string; description: string | null },
  ): Promise<UserGroupSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const row = await tx.userGroup.create({
        data: {
          companyId: actor.companyId,
          name: input.name.trim(),
          description: input.description,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'user_group.create',
        resource: 'user_group',
        resourceId: row.id,
        payload: { name: input.name },
      });
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        memberCount: 0,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  async update(
    actor: UserActor,
    id: string,
    input: { name?: string; description?: string | null },
  ): Promise<UserGroupSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await tx.userGroup.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The user group does not exist.');
      }
      const row = await tx.userGroup.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
      });
      const memberCount = await tx.userGroupMember.count({ where: { groupId: id } });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'user_group.update',
        resource: 'user_group',
        resourceId: id,
        payload: { name: row.name },
      });
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        memberCount,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  async remove(actor: UserActor, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await tx.userGroup.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The user group does not exist.');
      }
      await tx.userGroup.delete({ where: { id } });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'user_group.delete',
        resource: 'user_group',
        resourceId: id,
        payload: { name: existing.name },
      });
    });
  }

  async listMembers(companyId: string, groupId: string): Promise<UserGroupMemberSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const existing = await tx.userGroup.findFirst({ where: { id: groupId } });
      if (existing === null) {
        throw new NotFoundError('The user group does not exist.');
      }
      const members = await tx.userGroupMember.findMany({
        where: { groupId },
        orderBy: { createdAt: 'asc' },
      });
      const out: UserGroupMemberSummary[] = [];
      for (const m of members) {
        const user = await tx.user.findFirst({
          where: { id: m.userId },
          select: { id: true, email: true, displayName: true },
        });
        if (user !== null) {
          out.push({ userId: user.id, email: user.email, displayName: user.displayName });
        }
      }
      return out;
    });
  }

  async addMember(actor: UserActor, groupId: string, userId: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, actor.companyId, async (tx) => {
      const group = await tx.userGroup.findFirst({ where: { id: groupId } });
      if (group === null) {
        throw new NotFoundError('The user group does not exist.');
      }
      const user = await tx.user.findFirst({ where: { id: userId, companyId: actor.companyId } });
      if (user === null) {
        throw new NotFoundError('The user does not exist.');
      }
      await tx.userGroupMember.upsert({
        where: { groupId_userId: { groupId, userId } },
        create: { groupId, userId, companyId: actor.companyId },
        update: {},
      });
    });
  }

  async removeMember(actor: UserActor, groupId: string, userId: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, actor.companyId, async (tx) => {
      const group = await tx.userGroup.findFirst({ where: { id: groupId } });
      if (group === null) {
        throw new NotFoundError('The user group does not exist.');
      }
      await tx.userGroupMember.deleteMany({ where: { groupId, userId } });
    });
  }
}
