import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import {
  type EmployeeCertificationSummary,
  type EmployeeContactSummary,
  type EmployeeDocumentSummary,
  type EmployeeEducationSummary,
  type EmployeeExperienceSummary,
  type EmployeeFamilyMemberSummary,
  type EmployeeSkillSummary,
  type Paginated,
  normalisePageParams,
} from '@hris/shared-types';

import { CurrentAuth, CurrentPrincipal } from '../../common/auth/current.decorator';
import type { SessionPrincipal } from '../../common/auth/permission.service';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { EmployeeRecordsService } from './employee-records.service';

export class EmployeeRecordQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  cursor?: string;
}

export class ContactBodyDto {
  employeeId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  relationship!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class FamilyBodyDto {
  employeeId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  fullName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  relationship!: string;

  @IsOptional()
  @IsString()
  birthDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  occupation?: string | null;

  @IsOptional()
  @IsBoolean()
  isDependent?: boolean;
}

export class EducationBodyDto {
  employeeId?: string;

  @IsString()
  @IsIn(['HIGH_SCHOOL', 'DIPLOMA', 'BACHELOR', 'MASTER', 'DOCTORATE'])
  level!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  institution!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  major?: string | null;

  @IsInt()
  @Min(1950)
  startYear!: number;

  @IsOptional()
  @IsInt()
  @Min(1950)
  endYear?: number | null;
}

export class ExperienceBodyDto {
  employeeId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  companyName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  positionTitle!: string;

  @IsString()
  startDate!: string;

  @IsOptional()
  @IsString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class SkillBodyDto {
  employeeId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'])
  proficiency!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  yearsOfExperience?: number | null;
}

export class CertificationBodyDto {
  employeeId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  issuer!: string;

  @IsString()
  issueDate!: string;

  @IsOptional()
  @IsString()
  expiryDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  credentialId?: string | null;
}

export class DocumentBodyDto {
  employeeId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsIn(['CONTRACT', 'CERTIFICATE', 'IDENTITY', 'TAX', 'OTHER'])
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileUrl?: string | null;

  @IsOptional()
  @IsString()
  expiryDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

/**
 * Employee Data sub-record administration.
 *
 * Every route requires `employee:view`; mutations additionally require
 * company-wide scope (checked inside the service).
 */
@Controller('employees')
export class EmployeeRecordsController {
  constructor(@Inject(EmployeeRecordsService) private readonly records: EmployeeRecordsService) {}

  private query(query: EmployeeRecordQueryDto) {
    return normalisePageParams(query);
  }

  // -- Emergency contacts -----------------------------------------------------

  @Get('contacts')
  @RequirePermission('employee', 'view')
  listContacts(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: EmployeeRecordQueryDto,
  ): Promise<Paginated<EmployeeContactSummary>> {
    return this.records.listContacts(session.companyId, principal, query, this.query(query));
  }

  @Post('contacts')
  @RequirePermission('employee', 'create')
  @HttpCode(HttpStatus.CREATED)
  createContact(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: ContactBodyDto,
  ): Promise<EmployeeContactSummary> {
    return this.records.createContact(session.companyId, principal, {
      employeeId: dto.employeeId ?? '',
      name: dto.name,
      relationship: dto.relationship,
      phone: dto.phone,
      email: dto.email ?? null,
      address: dto.address ?? null,
      isPrimary: dto.isPrimary ?? false,
    });
  }

  @Patch('contacts/:id')
  @RequirePermission('employee', 'update')
  updateContact(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: ContactBodyDto,
  ): Promise<EmployeeContactSummary> {
    return this.records.updateContact(session.companyId, principal, id, {
      name: dto.name,
      relationship: dto.relationship,
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
      isPrimary: dto.isPrimary,
    });
  }

  @Delete('contacts/:id')
  @RequirePermission('employee', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeContact(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    return this.records.removeContact(session.companyId, principal, id);
  }

  // -- Family / dependents ----------------------------------------------------

  @Get('family')
  @RequirePermission('employee', 'view')
  listFamily(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: EmployeeRecordQueryDto,
  ): Promise<Paginated<EmployeeFamilyMemberSummary>> {
    return this.records.listFamily(session.companyId, principal, query, this.query(query));
  }

  @Post('family')
  @RequirePermission('employee', 'create')
  @HttpCode(HttpStatus.CREATED)
  createFamilyMember(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: FamilyBodyDto,
  ): Promise<EmployeeFamilyMemberSummary> {
    return this.records.createFamilyMember(session.companyId, principal, {
      employeeId: dto.employeeId ?? '',
      fullName: dto.fullName,
      relationship: dto.relationship,
      birthDate: dto.birthDate ?? null,
      occupation: dto.occupation ?? null,
      isDependent: dto.isDependent ?? false,
    });
  }

  @Patch('family/:id')
  @RequirePermission('employee', 'update')
  updateFamilyMember(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: FamilyBodyDto,
  ): Promise<EmployeeFamilyMemberSummary> {
    return this.records.updateFamilyMember(session.companyId, principal, id, {
      fullName: dto.fullName,
      relationship: dto.relationship,
      birthDate: dto.birthDate,
      occupation: dto.occupation,
      isDependent: dto.isDependent,
    });
  }

  @Delete('family/:id')
  @RequirePermission('employee', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFamilyMember(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    return this.records.removeFamilyMember(session.companyId, principal, id);
  }

  @Get('dependents')
  @RequirePermission('employee', 'view')
  listDependents(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: EmployeeRecordQueryDto,
  ): Promise<Paginated<EmployeeFamilyMemberSummary>> {
    return this.records.listFamily(session.companyId, principal, query, this.query(query), true);
  }

  // -- Education --------------------------------------------------------------

  @Get('education')
  @RequirePermission('employee', 'view')
  listEducation(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: EmployeeRecordQueryDto,
  ): Promise<Paginated<EmployeeEducationSummary>> {
    return this.records.listEducation(session.companyId, principal, query, this.query(query));
  }

  @Post('education')
  @RequirePermission('employee', 'create')
  @HttpCode(HttpStatus.CREATED)
  createEducation(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: EducationBodyDto,
  ): Promise<EmployeeEducationSummary> {
    return this.records.createEducation(session.companyId, principal, {
      employeeId: dto.employeeId ?? '',
      level: dto.level,
      institution: dto.institution,
      major: dto.major ?? null,
      startYear: dto.startYear,
      endYear: dto.endYear ?? null,
    });
  }

  @Patch('education/:id')
  @RequirePermission('employee', 'update')
  updateEducation(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: EducationBodyDto,
  ): Promise<EmployeeEducationSummary> {
    return this.records.updateEducation(session.companyId, principal, id, {
      level: dto.level,
      institution: dto.institution,
      major: dto.major,
      startYear: dto.startYear,
      endYear: dto.endYear,
    });
  }

  @Delete('education/:id')
  @RequirePermission('employee', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEducation(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    return this.records.removeEducation(session.companyId, principal, id);
  }

  // -- Experience -------------------------------------------------------------

  @Get('experience')
  @RequirePermission('employee', 'view')
  listExperience(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: EmployeeRecordQueryDto,
  ): Promise<Paginated<EmployeeExperienceSummary>> {
    return this.records.listExperience(session.companyId, principal, query, this.query(query));
  }

  @Post('experience')
  @RequirePermission('employee', 'create')
  @HttpCode(HttpStatus.CREATED)
  createExperience(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: ExperienceBodyDto,
  ): Promise<EmployeeExperienceSummary> {
    return this.records.createExperience(session.companyId, principal, {
      employeeId: dto.employeeId ?? '',
      companyName: dto.companyName,
      positionTitle: dto.positionTitle,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      description: dto.description ?? null,
    });
  }

  @Patch('experience/:id')
  @RequirePermission('employee', 'update')
  updateExperience(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: ExperienceBodyDto,
  ): Promise<EmployeeExperienceSummary> {
    return this.records.updateExperience(session.companyId, principal, id, {
      companyName: dto.companyName,
      positionTitle: dto.positionTitle,
      startDate: dto.startDate,
      endDate: dto.endDate,
      description: dto.description,
    });
  }

  @Delete('experience/:id')
  @RequirePermission('employee', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeExperience(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    return this.records.removeExperience(session.companyId, principal, id);
  }

  // -- Skills -----------------------------------------------------------------

  @Get('skills')
  @RequirePermission('employee', 'view')
  listSkills(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: EmployeeRecordQueryDto,
  ): Promise<Paginated<EmployeeSkillSummary>> {
    return this.records.listSkills(session.companyId, principal, query, this.query(query));
  }

  @Post('skills')
  @RequirePermission('employee', 'create')
  @HttpCode(HttpStatus.CREATED)
  createSkill(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: SkillBodyDto,
  ): Promise<EmployeeSkillSummary> {
    return this.records.createSkill(session.companyId, principal, {
      employeeId: dto.employeeId ?? '',
      name: dto.name,
      proficiency: dto.proficiency,
      yearsOfExperience: dto.yearsOfExperience ?? null,
    });
  }

  @Patch('skills/:id')
  @RequirePermission('employee', 'update')
  updateSkill(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: SkillBodyDto,
  ): Promise<EmployeeSkillSummary> {
    return this.records.updateSkill(session.companyId, principal, id, {
      name: dto.name,
      proficiency: dto.proficiency,
      yearsOfExperience: dto.yearsOfExperience,
    });
  }

  @Delete('skills/:id')
  @RequirePermission('employee', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSkill(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    return this.records.removeSkill(session.companyId, principal, id);
  }

  // -- Certifications ---------------------------------------------------------

  @Get('certifications')
  @RequirePermission('employee', 'view')
  listCertifications(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: EmployeeRecordQueryDto,
  ): Promise<Paginated<EmployeeCertificationSummary>> {
    return this.records.listCertifications(session.companyId, principal, query, this.query(query));
  }

  @Post('certifications')
  @RequirePermission('employee', 'create')
  @HttpCode(HttpStatus.CREATED)
  createCertification(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: CertificationBodyDto,
  ): Promise<EmployeeCertificationSummary> {
    return this.records.createCertification(session.companyId, principal, {
      employeeId: dto.employeeId ?? '',
      name: dto.name,
      issuer: dto.issuer,
      issueDate: dto.issueDate,
      expiryDate: dto.expiryDate ?? null,
      credentialId: dto.credentialId ?? null,
    });
  }

  @Patch('certifications/:id')
  @RequirePermission('employee', 'update')
  updateCertification(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: CertificationBodyDto,
  ): Promise<EmployeeCertificationSummary> {
    return this.records.updateCertification(session.companyId, principal, id, {
      name: dto.name,
      issuer: dto.issuer,
      issueDate: dto.issueDate,
      expiryDate: dto.expiryDate,
      credentialId: dto.credentialId,
    });
  }

  @Delete('certifications/:id')
  @RequirePermission('employee', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCertification(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    return this.records.removeCertification(session.companyId, principal, id);
  }

  // -- Documents --------------------------------------------------------------

  @Get('documents')
  @RequirePermission('employee', 'view')
  listDocuments(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Query() query: EmployeeRecordQueryDto,
  ): Promise<Paginated<EmployeeDocumentSummary>> {
    return this.records.listDocuments(session.companyId, principal, query, this.query(query));
  }

  @Post('documents')
  @RequirePermission('employee', 'create')
  @HttpCode(HttpStatus.CREATED)
  createDocument(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Body() dto: DocumentBodyDto,
  ): Promise<EmployeeDocumentSummary> {
    return this.records.createDocument(session.companyId, principal, {
      employeeId: dto.employeeId ?? '',
      title: dto.title,
      category: dto.category,
      fileUrl: dto.fileUrl ?? null,
      expiryDate: dto.expiryDate ?? null,
      note: dto.note ?? null,
    });
  }

  @Patch('documents/:id')
  @RequirePermission('employee', 'update')
  updateDocument(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
    @Body() dto: DocumentBodyDto,
  ): Promise<EmployeeDocumentSummary> {
    return this.records.updateDocument(session.companyId, principal, id, {
      title: dto.title,
      category: dto.category,
      fileUrl: dto.fileUrl,
      expiryDate: dto.expiryDate,
      note: dto.note,
    });
  }

  @Delete('documents/:id')
  @RequirePermission('employee', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDocument(
    @CurrentAuth() session: AuthenticatedRequest,
    @CurrentPrincipal() principal: SessionPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    return this.records.removeDocument(session.companyId, principal, id);
  }
}
