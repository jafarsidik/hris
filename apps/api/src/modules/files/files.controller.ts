import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
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

import { FILE_OBJECT_STATUSES, type FileObjectStatus } from '@hris/shared-types';

import { CurrentAuth } from '../../common/auth/current.decorator';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/auth/request-auth';
import { FilesService, MAX_RETENTION_DAYS, type FileActor } from './files.service';

/** Reserves an object. `size` is a hint used for display before the upload lands. */
export class CreateFileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  mimeType!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5_368_709_120)
  size?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entity?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_RETENTION_DAYS)
  retentionDays?: number;
}

export class ListFilesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entity?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsIn(FILE_OBJECT_STATUSES as readonly string[])
  status?: FileObjectStatus;
}

function actor(session: AuthenticatedRequest): FileActor {
  return { companyId: session.companyId, userId: session.userId };
}

/**
 * Files over the S3-compatible object store.
 *
 * Reads and metadata carry `document:view`; reserving and confirming carry
 * `document:create`; downloading carries `document:download` (so "may see the record" and
 * "may take the bytes" are separable); deleting carries `document:delete`. The tenant
 * boundary is enforced by row-level security on the metadata and by a fresh presign on
 * every download, never by a URL the client holds.
 */
@Controller('files')
export class FilesController {
  constructor(@Inject(FilesService) private readonly files: FilesService) {}

  @Get()
  @RequirePermission('document', 'view')
  async list(@CurrentAuth() session: AuthenticatedRequest, @Query() query: ListFilesQueryDto) {
    return this.files.list(session.companyId, query);
  }

  @Post()
  @RequirePermission('document', 'create')
  async create(@CurrentAuth() session: AuthenticatedRequest, @Body() body: CreateFileDto) {
    return this.files.create(actor(session), body);
  }

  @Get(':id')
  @RequirePermission('document', 'view')
  async get(@CurrentAuth() session: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.files.get(session.companyId, id);
  }

  @Get(':id/download')
  @RequirePermission('document', 'download')
  async download(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.files.download(actor(session), id);
  }

  @Post(':id/complete')
  @RequirePermission('document', 'create')
  @HttpCode(HttpStatus.OK)
  async complete(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.files.complete(actor(session), id);
  }

  @Delete(':id')
  @RequirePermission('document', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentAuth() session: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.files.remove(actor(session), id);
  }
}
