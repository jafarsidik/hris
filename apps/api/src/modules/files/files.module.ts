import { Module } from '@nestjs/common';

import { LogModule } from '../logs/log.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { S3StorageService } from './s3-storage.service';

/**
 * Files over the S3-compatible object store.
 *
 * `S3StorageService` is exported so other modules (a future employee-document upload, the
 * retention sweep in the worker) can presign or purge without re-implementing SigV4, and
 * so the storage boundary stays one class wide.
 */
@Module({
  imports: [LogModule],
  controllers: [FilesController],
  providers: [FilesService, S3StorageService],
  exports: [FilesService, S3StorageService],
})
export class FilesModule {}
