import { Inject, Injectable } from '@nestjs/common';

import {
  type Prisma,
  findOrgUnitEntity,
  findOrgUnitSubtree,
  withTenantContext,
} from '@hris/database';
import {
  buildPage,
  cursorFingerprint,
  resolveCursor,
  type EmployeeCertificationSummary,
  type EmployeeContactSummary,
  type EmployeeDocumentSummary,
  type EmployeeEducationSummary,
  type EmployeeExperienceSummary,
  type EmployeeFamilyMemberSummary,
  type EmployeeRecordQuery,
  type EmployeeSkillSummary,
  type Paginated,
  type PageParams,
} from '@hris/shared-types';

import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';
import { resolveScope, type ScopeDecision } from '../../common/auth/data-scope';
import { type SessionPrincipal } from '../../common/auth/permission.service';
import { NotFoundError, OutOfScopeError, ValidationError } from '../../common/errors/app-error';

const SORT = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

/** The employee fields every record summary needs. */
const EMPLOYEE_FIELDS = {
  employee: {
    select: { id: true, employeeNumber: true, user: { select: { displayName: true } } },
  },
} as const;

function employeeOf(row: { readonly employee: EmployeeReadRow }): EmployeeRead {
  return {
    employeeId: row.employee.id,
    employeeName: row.employee.user.displayName,
    employeeNumber: row.employee.employeeNumber,
  };
}

interface EmployeeReadRow {
  readonly id: string;
  readonly employeeNumber: string;
  readonly user: { readonly displayName: string };
}

interface ContactRow {
  readonly id: string;
  readonly name: string;
  readonly relationship: string;
  readonly phone: string;
  readonly email: string | null;
  readonly address: string | null;
  readonly isPrimary: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly employee: EmployeeReadRow;
}

interface FamilyRow {
  readonly id: string;
  readonly fullName: string;
  readonly relationship: string;
  readonly birthDate: Date | null;
  readonly occupation: string | null;
  readonly isDependent: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly employee: EmployeeReadRow;
}

interface EducationRow {
  readonly id: string;
  readonly level: string;
  readonly institution: string;
  readonly major: string | null;
  readonly startYear: number;
  readonly endYear: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly employee: EmployeeReadRow;
}

interface ExperienceRow {
  readonly id: string;
  readonly companyName: string;
  readonly positionTitle: string;
  readonly startDate: Date;
  readonly endDate: Date | null;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly employee: EmployeeReadRow;
}

interface SkillRow {
  readonly id: string;
  readonly name: string;
  readonly proficiency: string;
  readonly yearsOfExperience: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly employee: EmployeeReadRow;
}

interface CertificationRow {
  readonly id: string;
  readonly name: string;
  readonly issuer: string;
  readonly issueDate: Date;
  readonly expiryDate: Date | null;
  readonly credentialId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly employee: EmployeeReadRow;
}

interface DocumentRow {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly fileUrl: string | null;
  readonly expiryDate: Date | null;
  readonly note: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly employee: EmployeeReadRow;
}

/**
 * Employee Data sub-records: emergency contacts, family (with dependents),
 * education, experience, skills, certifications and documents.
 *
 * Reads narrow to the caller's `employee:view` scope through the owning
 * employee's organizational unit. Writes require company-wide scope.
 */
@Injectable()
export class EmployeeRecordsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  // ---------------------------------------------------------------------------
  // Emergency contacts
  // ---------------------------------------------------------------------------

  async listContacts(
    companyId: string,
    principal: SessionPrincipal,
    filter: EmployeeRecordQuery,
    params: PageParams,
  ): Promise<Paginated<EmployeeContactSummary>> {
    const { where, fingerprint, take } = await this.listArgs(companyId, principal, filter, params);
    const client = this.prisma.getClient();
    const rows = await withTenantContext(
      client,
      companyId,
      async (tx) =>
        tx.employeeContact.findMany({
          where,
          orderBy: SORT,
          include: EMPLOYEE_FIELDS,
          take,
        }) as unknown as ContactRow[],
    );
    return this.paginate(rows, params, fingerprint, contactSummary);
  }

  async createContact(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly employeeId: string;
      readonly name: string;
      readonly relationship: string;
      readonly phone: string;
      readonly email: string | null;
      readonly address: string | null;
      readonly isPrimary: boolean;
    },
  ): Promise<EmployeeContactSummary> {
    const created = await this.write(
      companyId,
      principal,
      principal.user.id,
      'employee.contact_created',
      async (tx) => {
        await this.assertEmployee(tx, companyId, input.employeeId);
        const row = (await tx.employeeContact.create({
          data: {
            companyId,
            employeeId: input.employeeId,
            name: input.name,
            relationship: input.relationship,
            phone: input.phone,
            email: input.email,
            address: input.address,
            isPrimary: input.isPrimary,
            createdBy: principal.user.id,
          },
          include: EMPLOYEE_FIELDS,
        })) as unknown as ContactRow;
        return contactSummary(row);
      },
    );
    return created;
  }

  async updateContact(
    companyId: string,
    principal: SessionPrincipal,
    id: string,
    input: {
      readonly name?: string;
      readonly relationship?: string;
      readonly phone?: string;
      readonly email?: string | null;
      readonly address?: string | null;
      readonly isPrimary?: boolean;
    },
  ): Promise<EmployeeContactSummary> {
    return this.write(companyId, principal, id, 'employee.contact_updated', async (tx) => {
      const row = (await tx.employeeContact.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.relationship === undefined ? {} : { relationship: input.relationship }),
          ...(input.phone === undefined ? {} : { phone: input.phone }),
          ...(input.email === undefined ? {} : { email: input.email }),
          ...(input.address === undefined ? {} : { address: input.address }),
          ...(input.isPrimary === undefined ? {} : { isPrimary: input.isPrimary }),
        },
        include: EMPLOYEE_FIELDS,
      })) as unknown as ContactRow;
      return contactSummary(row);
    });
  }

  async removeContact(companyId: string, principal: SessionPrincipal, id: string): Promise<void> {
    await this.write(companyId, principal, id, 'employee.contact_deleted', async (tx) => {
      await tx.employeeContact.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  // ---------------------------------------------------------------------------
  // Family (Family + Dependents)
  // ---------------------------------------------------------------------------

  async listFamily(
    companyId: string,
    principal: SessionPrincipal,
    filter: EmployeeRecordQuery,
    params: PageParams,
    dependentsOnly = false,
  ): Promise<Paginated<EmployeeFamilyMemberSummary>> {
    const { where, fingerprint, take } = await this.listArgs(companyId, principal, filter, params, {
      ...(dependentsOnly ? { isDependent: true } : {}),
    });
    const client = this.prisma.getClient();
    const rows = await withTenantContext(
      client,
      companyId,
      async (tx) =>
        tx.employeeFamilyMember.findMany({
          where,
          orderBy: SORT,
          include: EMPLOYEE_FIELDS,
          take,
        }) as unknown as FamilyRow[],
    );
    return this.paginate(rows, params, fingerprint, familySummary);
  }

  async createFamilyMember(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly employeeId: string;
      readonly fullName: string;
      readonly relationship: string;
      readonly birthDate: string | null;
      readonly occupation: string | null;
      readonly isDependent: boolean;
    },
  ): Promise<EmployeeFamilyMemberSummary> {
    return this.write(
      companyId,
      principal,
      principal.user.id,
      'employee.family_created',
      async (tx) => {
        await this.assertEmployee(tx, companyId, input.employeeId);
        const row = (await tx.employeeFamilyMember.create({
          data: {
            companyId,
            employeeId: input.employeeId,
            fullName: input.fullName,
            relationship: input.relationship,
            birthDate: input.birthDate === null ? null : new Date(input.birthDate),
            occupation: input.occupation,
            isDependent: input.isDependent,
            createdBy: principal.user.id,
          },
          include: EMPLOYEE_FIELDS,
        })) as unknown as FamilyRow;
        return familySummary(row);
      },
    );
  }

  async updateFamilyMember(
    companyId: string,
    principal: SessionPrincipal,
    id: string,
    input: {
      readonly fullName?: string;
      readonly relationship?: string;
      readonly birthDate?: string | null;
      readonly occupation?: string | null;
      readonly isDependent?: boolean;
    },
  ): Promise<EmployeeFamilyMemberSummary> {
    return this.write(companyId, principal, id, 'employee.family_updated', async (tx) => {
      const row = (await tx.employeeFamilyMember.update({
        where: { id },
        data: {
          ...(input.fullName === undefined ? {} : { fullName: input.fullName }),
          ...(input.relationship === undefined ? {} : { relationship: input.relationship }),
          ...(input.birthDate === undefined
            ? {}
            : { birthDate: input.birthDate === null ? null : new Date(input.birthDate) }),
          ...(input.occupation === undefined ? {} : { occupation: input.occupation }),
          ...(input.isDependent === undefined ? {} : { isDependent: input.isDependent }),
        },
        include: EMPLOYEE_FIELDS,
      })) as unknown as FamilyRow;
      return familySummary(row);
    });
  }

  async removeFamilyMember(
    companyId: string,
    principal: SessionPrincipal,
    id: string,
  ): Promise<void> {
    await this.write(companyId, principal, id, 'employee.family_deleted', async (tx) => {
      await tx.employeeFamilyMember.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  // ---------------------------------------------------------------------------
  // Education
  // ---------------------------------------------------------------------------

  async listEducation(
    companyId: string,
    principal: SessionPrincipal,
    filter: EmployeeRecordQuery,
    params: PageParams,
  ): Promise<Paginated<EmployeeEducationSummary>> {
    const { where, fingerprint, take } = await this.listArgs(companyId, principal, filter, params);
    const client = this.prisma.getClient();
    const rows = await withTenantContext(
      client,
      companyId,
      async (tx) =>
        tx.employeeEducation.findMany({
          where,
          orderBy: SORT,
          include: EMPLOYEE_FIELDS,
          take,
        }) as unknown as EducationRow[],
    );
    return this.paginate(rows, params, fingerprint, educationSummary);
  }

  async createEducation(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly employeeId: string;
      readonly level: string;
      readonly institution: string;
      readonly major: string | null;
      readonly startYear: number;
      readonly endYear: number | null;
    },
  ): Promise<EmployeeEducationSummary> {
    return this.write(
      companyId,
      principal,
      principal.user.id,
      'employee.education_created',
      async (tx) => {
        await this.assertEmployee(tx, companyId, input.employeeId);
        const row = (await tx.employeeEducation.create({
          data: {
            companyId,
            employeeId: input.employeeId,
            level: input.level,
            institution: input.institution,
            major: input.major,
            startYear: input.startYear,
            endYear: input.endYear,
            createdBy: principal.user.id,
          },
          include: EMPLOYEE_FIELDS,
        })) as unknown as EducationRow;
        return educationSummary(row);
      },
    );
  }

  async updateEducation(
    companyId: string,
    principal: SessionPrincipal,
    id: string,
    input: {
      readonly level?: string;
      readonly institution?: string;
      readonly major?: string | null;
      readonly startYear?: number;
      readonly endYear?: number | null;
    },
  ): Promise<EmployeeEducationSummary> {
    return this.write(companyId, principal, id, 'employee.education_updated', async (tx) => {
      const row = (await tx.employeeEducation.update({
        where: { id },
        data: {
          ...(input.level === undefined ? {} : { level: input.level }),
          ...(input.institution === undefined ? {} : { institution: input.institution }),
          ...(input.major === undefined ? {} : { major: input.major }),
          ...(input.startYear === undefined ? {} : { startYear: input.startYear }),
          ...(input.endYear === undefined ? {} : { endYear: input.endYear }),
        },
        include: EMPLOYEE_FIELDS,
      })) as unknown as EducationRow;
      return educationSummary(row);
    });
  }

  async removeEducation(companyId: string, principal: SessionPrincipal, id: string): Promise<void> {
    await this.write(companyId, principal, id, 'employee.education_deleted', async (tx) => {
      await tx.employeeEducation.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  // ---------------------------------------------------------------------------
  // Experience
  // ---------------------------------------------------------------------------

  async listExperience(
    companyId: string,
    principal: SessionPrincipal,
    filter: EmployeeRecordQuery,
    params: PageParams,
  ): Promise<Paginated<EmployeeExperienceSummary>> {
    const { where, fingerprint, take } = await this.listArgs(companyId, principal, filter, params);
    const client = this.prisma.getClient();
    const rows = await withTenantContext(
      client,
      companyId,
      async (tx) =>
        tx.employeeExperience.findMany({
          where,
          orderBy: SORT,
          include: EMPLOYEE_FIELDS,
          take,
        }) as unknown as ExperienceRow[],
    );
    return this.paginate(rows, params, fingerprint, experienceSummary);
  }

  async createExperience(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly employeeId: string;
      readonly companyName: string;
      readonly positionTitle: string;
      readonly startDate: string;
      readonly endDate: string | null;
      readonly description: string | null;
    },
  ): Promise<EmployeeExperienceSummary> {
    return this.write(
      companyId,
      principal,
      principal.user.id,
      'employee.experience_created',
      async (tx) => {
        await this.assertEmployee(tx, companyId, input.employeeId);
        const row = (await tx.employeeExperience.create({
          data: {
            companyId,
            employeeId: input.employeeId,
            companyName: input.companyName,
            positionTitle: input.positionTitle,
            startDate: new Date(input.startDate),
            endDate: input.endDate === null ? null : new Date(input.endDate),
            description: input.description,
            createdBy: principal.user.id,
          },
          include: EMPLOYEE_FIELDS,
        })) as unknown as ExperienceRow;
        return experienceSummary(row);
      },
    );
  }

  async updateExperience(
    companyId: string,
    principal: SessionPrincipal,
    id: string,
    input: {
      readonly companyName?: string;
      readonly positionTitle?: string;
      readonly startDate?: string;
      readonly endDate?: string | null;
      readonly description?: string | null;
    },
  ): Promise<EmployeeExperienceSummary> {
    return this.write(companyId, principal, id, 'employee.experience_updated', async (tx) => {
      const row = (await tx.employeeExperience.update({
        where: { id },
        data: {
          ...(input.companyName === undefined ? {} : { companyName: input.companyName }),
          ...(input.positionTitle === undefined ? {} : { positionTitle: input.positionTitle }),
          ...(input.startDate === undefined ? {} : { startDate: new Date(input.startDate) }),
          ...(input.endDate === undefined
            ? {}
            : { endDate: input.endDate === null ? null : new Date(input.endDate) }),
          ...(input.description === undefined ? {} : { description: input.description }),
        },
        include: EMPLOYEE_FIELDS,
      })) as unknown as ExperienceRow;
      return experienceSummary(row);
    });
  }

  async removeExperience(
    companyId: string,
    principal: SessionPrincipal,
    id: string,
  ): Promise<void> {
    await this.write(companyId, principal, id, 'employee.experience_deleted', async (tx) => {
      await tx.employeeExperience.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  // ---------------------------------------------------------------------------
  // Skills
  // ---------------------------------------------------------------------------

  async listSkills(
    companyId: string,
    principal: SessionPrincipal,
    filter: EmployeeRecordQuery,
    params: PageParams,
  ): Promise<Paginated<EmployeeSkillSummary>> {
    const { where, fingerprint, take } = await this.listArgs(companyId, principal, filter, params);
    const client = this.prisma.getClient();
    const rows = await withTenantContext(
      client,
      companyId,
      async (tx) =>
        tx.employeeSkill.findMany({
          where,
          orderBy: SORT,
          include: EMPLOYEE_FIELDS,
          take,
        }) as unknown as SkillRow[],
    );
    return this.paginate(rows, params, fingerprint, skillSummary);
  }

  async createSkill(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly employeeId: string;
      readonly name: string;
      readonly proficiency: string;
      readonly yearsOfExperience: number | null;
    },
  ): Promise<EmployeeSkillSummary> {
    return this.write(
      companyId,
      principal,
      principal.user.id,
      'employee.skill_created',
      async (tx) => {
        await this.assertEmployee(tx, companyId, input.employeeId);
        const row = (await tx.employeeSkill.create({
          data: {
            companyId,
            employeeId: input.employeeId,
            name: input.name,
            proficiency: input.proficiency,
            yearsOfExperience: input.yearsOfExperience,
            createdBy: principal.user.id,
          },
          include: EMPLOYEE_FIELDS,
        })) as unknown as SkillRow;
        return skillSummary(row);
      },
    );
  }

  async updateSkill(
    companyId: string,
    principal: SessionPrincipal,
    id: string,
    input: {
      readonly name?: string;
      readonly proficiency?: string;
      readonly yearsOfExperience?: number | null;
    },
  ): Promise<EmployeeSkillSummary> {
    return this.write(companyId, principal, id, 'employee.skill_updated', async (tx) => {
      const row = (await tx.employeeSkill.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.proficiency === undefined ? {} : { proficiency: input.proficiency }),
          ...(input.yearsOfExperience === undefined
            ? {}
            : { yearsOfExperience: input.yearsOfExperience }),
        },
        include: EMPLOYEE_FIELDS,
      })) as unknown as SkillRow;
      return skillSummary(row);
    });
  }

  async removeSkill(companyId: string, principal: SessionPrincipal, id: string): Promise<void> {
    await this.write(companyId, principal, id, 'employee.skill_deleted', async (tx) => {
      await tx.employeeSkill.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  // ---------------------------------------------------------------------------
  // Certifications
  // ---------------------------------------------------------------------------

  async listCertifications(
    companyId: string,
    principal: SessionPrincipal,
    filter: EmployeeRecordQuery,
    params: PageParams,
  ): Promise<Paginated<EmployeeCertificationSummary>> {
    const { where, fingerprint, take } = await this.listArgs(companyId, principal, filter, params);
    const client = this.prisma.getClient();
    const rows = await withTenantContext(
      client,
      companyId,
      async (tx) =>
        tx.employeeCertification.findMany({
          where,
          orderBy: SORT,
          include: EMPLOYEE_FIELDS,
          take,
        }) as unknown as CertificationRow[],
    );
    return this.paginate(rows, params, fingerprint, certificationSummary);
  }

  async createCertification(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly employeeId: string;
      readonly name: string;
      readonly issuer: string;
      readonly issueDate: string;
      readonly expiryDate: string | null;
      readonly credentialId: string | null;
    },
  ): Promise<EmployeeCertificationSummary> {
    return this.write(
      companyId,
      principal,
      principal.user.id,
      'employee.certification_created',
      async (tx) => {
        await this.assertEmployee(tx, companyId, input.employeeId);
        const row = (await tx.employeeCertification.create({
          data: {
            companyId,
            employeeId: input.employeeId,
            name: input.name,
            issuer: input.issuer,
            issueDate: new Date(input.issueDate),
            expiryDate: input.expiryDate === null ? null : new Date(input.expiryDate),
            credentialId: input.credentialId,
            createdBy: principal.user.id,
          },
          include: EMPLOYEE_FIELDS,
        })) as unknown as CertificationRow;
        return certificationSummary(row);
      },
    );
  }

  async updateCertification(
    companyId: string,
    principal: SessionPrincipal,
    id: string,
    input: {
      readonly name?: string;
      readonly issuer?: string;
      readonly issueDate?: string;
      readonly expiryDate?: string | null;
      readonly credentialId?: string | null;
    },
  ): Promise<EmployeeCertificationSummary> {
    return this.write(companyId, principal, id, 'employee.certification_updated', async (tx) => {
      const row = (await tx.employeeCertification.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.issuer === undefined ? {} : { issuer: input.issuer }),
          ...(input.issueDate === undefined ? {} : { issueDate: new Date(input.issueDate) }),
          ...(input.expiryDate === undefined
            ? {}
            : { expiryDate: input.expiryDate === null ? null : new Date(input.expiryDate) }),
          ...(input.credentialId === undefined ? {} : { credentialId: input.credentialId }),
        },
        include: EMPLOYEE_FIELDS,
      })) as unknown as CertificationRow;
      return certificationSummary(row);
    });
  }

  async removeCertification(
    companyId: string,
    principal: SessionPrincipal,
    id: string,
  ): Promise<void> {
    await this.write(companyId, principal, id, 'employee.certification_deleted', async (tx) => {
      await tx.employeeCertification.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  // ---------------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------------

  async listDocuments(
    companyId: string,
    principal: SessionPrincipal,
    filter: EmployeeRecordQuery,
    params: PageParams,
  ): Promise<Paginated<EmployeeDocumentSummary>> {
    const { where, fingerprint, take } = await this.listArgs(companyId, principal, filter, params);
    const client = this.prisma.getClient();
    const rows = await withTenantContext(
      client,
      companyId,
      async (tx) =>
        tx.employeeDocument.findMany({
          where,
          orderBy: SORT,
          include: EMPLOYEE_FIELDS,
          take,
        }) as unknown as DocumentRow[],
    );
    return this.paginate(rows, params, fingerprint, documentSummary);
  }

  async createDocument(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly employeeId: string;
      readonly title: string;
      readonly category: string;
      readonly fileUrl: string | null;
      readonly expiryDate: string | null;
      readonly note: string | null;
    },
  ): Promise<EmployeeDocumentSummary> {
    return this.write(
      companyId,
      principal,
      principal.user.id,
      'employee.document_created',
      async (tx) => {
        await this.assertEmployee(tx, companyId, input.employeeId);
        const row = (await tx.employeeDocument.create({
          data: {
            companyId,
            employeeId: input.employeeId,
            title: input.title,
            category: input.category,
            fileUrl: input.fileUrl,
            expiryDate: input.expiryDate === null ? null : new Date(input.expiryDate),
            note: input.note,
            createdBy: principal.user.id,
          },
          include: EMPLOYEE_FIELDS,
        })) as unknown as DocumentRow;
        return documentSummary(row);
      },
    );
  }

  async updateDocument(
    companyId: string,
    principal: SessionPrincipal,
    id: string,
    input: {
      readonly title?: string;
      readonly category?: string;
      readonly fileUrl?: string | null;
      readonly expiryDate?: string | null;
      readonly note?: string | null;
    },
  ): Promise<EmployeeDocumentSummary> {
    return this.write(companyId, principal, id, 'employee.document_updated', async (tx) => {
      const row = (await tx.employeeDocument.update({
        where: { id },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.category === undefined ? {} : { category: input.category }),
          ...(input.fileUrl === undefined ? {} : { fileUrl: input.fileUrl }),
          ...(input.expiryDate === undefined
            ? {}
            : { expiryDate: input.expiryDate === null ? null : new Date(input.expiryDate) }),
          ...(input.note === undefined ? {} : { note: input.note }),
        },
        include: EMPLOYEE_FIELDS,
      })) as unknown as DocumentRow;
      return documentSummary(row);
    });
  }

  async removeDocument(companyId: string, principal: SessionPrincipal, id: string): Promise<void> {
    await this.write(companyId, principal, id, 'employee.document_deleted', async (tx) => {
      await tx.employeeDocument.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  // ---------------------------------------------------------------------------
  // Shared internals
  // ---------------------------------------------------------------------------

  private async listArgs(
    companyId: string,
    principal: SessionPrincipal,
    filter: EmployeeRecordQuery,
    params: PageParams,
    extraWhere: Record<string, unknown> = {},
  ): Promise<{
    readonly where: Record<string, unknown>;
    readonly take: number;
    readonly fingerprint: string;
  }> {
    const decision = this.readScope(principal);
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: { createdAt: 'desc', id: 'desc' } as const,
    });
    const resolution = resolveCursor(params.cursor, fingerprint);
    if (!resolution.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }
    const values = resolution.cursor.position.values;
    const after: Record<string, unknown> =
      values.length > 0
        ? {
            OR: [
              { createdAt: { lt: new Date(values[0] ?? '') } },
              { createdAt: new Date(values[0] ?? ''), id: { lt: values[1] ?? '' } },
            ],
          }
        : {};

    const client = this.prisma.getClient();
    const scope = await withTenantContext(client, companyId, (tx) =>
      this.readScopeWhere(tx, decision, principal.user.id),
    );
    const search = filter.search?.trim() ?? '';
    return {
      where: {
        companyId,
        deletedAt: null,
        ...scope,
        ...extraWhere,
        ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
        ...(search ? { OR: employeeSearchOR(search) } : {}),
        ...after,
      },
      take: params.limit + 1,
      fingerprint,
    };
  }

  private async readScopeWhere(
    tx: Prisma.TransactionClient,
    decision: ScopeDecision,
    callerUserId: string,
  ): Promise<Record<string, unknown>> {
    switch (decision.kind) {
      case 'all':
        return {};
      case 'self':
        return { employee: { userId: callerUserId } };
      case 'subtree': {
        const unitIds = await findOrgUnitSubtree(tx, decision.rootUnitId);
        return unitIds.length > 0
          ? { employee: { unit: { id: { in: unitIds } } } }
          : { employee: { unit: { id: { in: [] } } } };
      }
      case 'entity': {
        const entityId = await findOrgUnitEntity(tx, decision.rootUnitId);
        return entityId
          ? { employee: { unit: { entityId } } }
          : { employee: { unit: { id: { in: [] } } } };
      }
      default:
        return { employee: { unit: { id: { in: [] } } } };
    }
  }

  private paginate<T>(
    rows: readonly { readonly createdAt: Date; readonly id: string }[],
    params: PageParams,
    fingerprint: string,
    map: (row: unknown) => T,
  ): Paginated<T> {
    const items = rows.map((row) => map(row));
    return buildPage(items, params, fingerprint, (item) => ({
      values: [
        (item as { readonly createdAt: string }).createdAt,
        (item as { readonly id: string }).id,
      ],
    }));
  }

  private async write<T>(
    companyId: string,
    principal: SessionPrincipal,
    resourceId: string,
    action: string,
    run: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    this.assertWritableScope(principal);
    const client = this.prisma.getClient();
    const result = await withTenantContext(client, companyId, run);
    await this.audit(companyId, principal.user.id, action, resourceId);
    return result;
  }

  private async assertExists(
    tx: Prisma.TransactionClient,
    lookup: () => Promise<unknown>,
  ): Promise<void> {
    const row = await lookup();
    if (row === null) {
      throw new NotFoundError('The record does not exist.');
    }
  }

  private readScope(principal: SessionPrincipal): ScopeDecision {
    const decision = resolveScope(principal.permissions, 'employee', 'view', {
      userId: principal.user.id,
      unitId: principal.user.organizationalUnitId,
    });
    if (decision.kind === 'denied') {
      throw new OutOfScopeError(
        `Your "${decision.scope ?? 'unresolved'}" scope for employee.view cannot be resolved.`,
      );
    }
    return decision;
  }

  private assertWritableScope(principal: SessionPrincipal): void {
    const decision = this.readScope(principal);
    if (decision.kind !== 'all') {
      throw new OutOfScopeError('Editing employee data requires company-wide data scope.');
    }
  }

  private async assertEmployee(
    tx: Prisma.TransactionClient,
    companyId: string,
    employeeId: string,
  ): Promise<void> {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (employee === null) {
      throw new NotFoundError('The employee does not exist.');
    }
  }

  private async audit(
    companyId: string,
    actorUserId: string,
    action: string,
    resourceId: string,
  ): Promise<void> {
    await this.logs.recordEvent(companyId, {
      category: 'ACTIVITY',
      eventType: action,
      actorUserId,
      resource: 'employee',
      resourceId,
      status: 'SUCCESS',
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action,
      resource: 'employee',
      resourceId,
    });
  }
}

type EmployeeRead = {
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeNumber: string;
};

function employeeSearchOR(search: string): Record<string, unknown>[] {
  return [
    { employee: { user: { displayName: { contains: search, mode: 'insensitive' as const } } } },
    { employee: { employeeNumber: { contains: search, mode: 'insensitive' as const } } },
  ];
}

function contactSummary(row: unknown): EmployeeContactSummary {
  const r = row as unknown as ContactRow;
  return {
    ...employeeOf(r),
    id: r.id,
    name: r.name,
    relationship: r.relationship,
    phone: r.phone,
    email: r.email,
    address: r.address,
    isPrimary: r.isPrimary,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function familySummary(row: unknown): EmployeeFamilyMemberSummary {
  const r = row as unknown as FamilyRow;
  return {
    ...employeeOf(r),
    id: r.id,
    fullName: r.fullName,
    relationship: r.relationship,
    birthDate: r.birthDate?.toISOString() ?? null,
    occupation: r.occupation,
    isDependent: r.isDependent,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function educationSummary(row: unknown): EmployeeEducationSummary {
  const r = row as unknown as EducationRow;
  return {
    ...employeeOf(r),
    id: r.id,
    level: r.level,
    institution: r.institution,
    major: r.major,
    startYear: r.startYear,
    endYear: r.endYear,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function experienceSummary(row: unknown): EmployeeExperienceSummary {
  const r = row as unknown as ExperienceRow;
  return {
    ...employeeOf(r),
    id: r.id,
    companyName: r.companyName,
    positionTitle: r.positionTitle,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate?.toISOString() ?? null,
    description: r.description,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function skillSummary(row: unknown): EmployeeSkillSummary {
  const r = row as unknown as SkillRow;
  return {
    ...employeeOf(r),
    id: r.id,
    name: r.name,
    proficiency: r.proficiency,
    yearsOfExperience: r.yearsOfExperience,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function certificationSummary(row: unknown): EmployeeCertificationSummary {
  const r = row as unknown as CertificationRow;
  return {
    ...employeeOf(r),
    id: r.id,
    name: r.name,
    issuer: r.issuer,
    issueDate: r.issueDate.toISOString(),
    expiryDate: r.expiryDate?.toISOString() ?? null,
    credentialId: r.credentialId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function documentSummary(row: unknown): EmployeeDocumentSummary {
  const r = row as unknown as DocumentRow;
  return {
    ...employeeOf(r),
    id: r.id,
    title: r.title,
    category: r.category,
    fileUrl: r.fileUrl,
    expiryDate: r.expiryDate?.toISOString() ?? null,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
