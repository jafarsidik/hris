import type { FileObjectSummary } from '@hris/shared-types';

import { filesApi, uploadFile } from '@/features/files/files-api';

/**
 * Employee photos live in the object store, not in the employee row.
 *
 * A photo is an image `FileObject` whose `entity` is `employee` and whose `entityId` is
 * the employee id. That reuses the upload/download pipeline the rest of the platform
 * already has: presigned PUT to storage, metadata and authorisation in the API, and a
 * fresh presigned GET for every view. It also means no schema migration was needed to
 * add the feature, and the same record can be listed as an employee document later.
 *
 * The newest image wins. Uploading a replacement therefore does not delete the previous
 * object — storage versioning already keeps history, and deleting someone's old photo is
 * not a decision this screen gets to make on their behalf.
 */

export interface EmployeePhoto {
  readonly fileId: string;
  readonly url: string;
}

const PHOTO_ENTITY = 'employee';

const isImage = (file: FileObjectSummary): boolean =>
  file.mimeType.startsWith('image/') && file.status !== 'DELETED';

/** The employee's current photo, or null when they have none. */
export async function loadEmployeePhoto(employeeId: string): Promise<EmployeePhoto | null> {
  const files = await filesApi.list({ entity: PHOTO_ENTITY, entityId: employeeId });
  const newest = files
    .filter(isImage)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  if (newest === undefined) {
    return null;
  }

  const ticket = await filesApi.download(newest.id);
  return { fileId: newest.id, url: ticket.downloadUrl };
}

/** Uploads a new photo for the employee and returns its preview URL. */
export async function uploadEmployeePhoto(employeeId: string, file: File): Promise<EmployeePhoto> {
  const stored = await uploadFile(file, { entity: PHOTO_ENTITY, entityId: employeeId });
  const ticket = await filesApi.download(stored.id);
  return { fileId: stored.id, url: ticket.downloadUrl };
}
