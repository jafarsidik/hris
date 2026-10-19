import { apiRequestV1 } from '@/lib/api/client-config';

/**
 * Record kinds with writable endpoints, in the same plural spelling the API
 * routes use: `POST /employees/{kind}`, `PATCH /employees/{kind}/:id`,
 * `DELETE /employees/{kind}/:id`.
 */
export type RecordKind =
  | 'contacts'
  | 'family'
  | 'education'
  | 'experience'
  | 'skills'
  | 'certifications'
  | 'documents'
  | 'contracts';

/** One record's editable fields, already shaped for the field schema. Booleans
 *  ride along for the checkbox fields; empty string means "unset" for optional
 *  text fields and is mapped to null on the way out. */
export type RecordDraft = Record<string, string | boolean>;

const asNullable = (value: string): string | null => (value === '' ? null : value);

/** Serialize a checked box into the API's optional boolean — present when the
 *  scheme declares the field, always false-safe otherwise. */
const flag = (draft: RecordDraft, name: string): boolean | undefined =>
  typeof draft[name] === 'undefined' ? undefined : draft[name] === true;

/**
 * Create or update one record under the employee's profile.
 *
 * PATCHes carry the complete field set: the schema's fields are exactly the
 * API's body fields, so a full replace is both honest and idempotent — the
 * same request replayed edits nothing.
 */
export async function saveRecord(
  kind: RecordKind,
  employeeId: string,
  draft: RecordDraft,
  id?: string,
): Promise<void> {
  const value = (name: string): string | null => asNullable(String(draft[name] ?? ''));

  let body: Record<string, unknown>;
  if (kind === 'contacts') {
    body = {
      employeeId,
      name: value('name'),
      relationship: value('relationship'),
      phone: value('phone'),
      email: value('email'),
      address: value('address'),
      isPrimary: flag(draft, 'isPrimary') ?? false,
    };
  } else if (kind === 'family') {
    body = {
      employeeId,
      fullName: value('fullName'),
      relationship: value('relationship'),
      birthDate: value('birthDate'),
      occupation: value('occupation'),
      isDependent: flag(draft, 'isDependent') ?? false,
    };
  } else if (kind === 'education') {
    body = {
      employeeId,
      level: value('level'),
      institution: value('institution'),
      major: value('major'),
      startYear: Number(value('startYear')),
      endYear: value('endYear') === null ? null : Number(value('endYear')),
    };
  } else if (kind === 'experience') {
    body = {
      employeeId,
      companyName: value('companyName'),
      positionTitle: value('positionTitle'),
      startDate: value('startDate'),
      endDate: value('endDate'),
      description: value('description'),
    };
  } else if (kind === 'skills') {
    body = {
      employeeId,
      name: value('name'),
      proficiency: value('proficiency'),
      yearsOfExperience:
        value('yearsOfExperience') === null ? null : Number(value('yearsOfExperience')),
    };
  } else if (kind === 'certifications') {
    body = {
      employeeId,
      name: value('name'),
      issuer: value('issuer'),
      issueDate: value('issueDate'),
      expiryDate: value('expiryDate'),
      credentialId: value('credentialId'),
    };
  } else if (kind === 'documents') {
    body = {
      employeeId,
      title: value('title'),
      category: value('category'),
      fileUrl: value('fileUrl'),
      expiryDate: value('expiryDate'),
      note: value('note'),
    };
  } else {
    body = {
      employeeId,
      contractNumber: value('contractNumber'),
      contractType: value('contractType'),
      startDate: value('startDate'),
      endDate: value('endDate'),
      status: value('status'),
      signedDate: value('signedDate'),
      notes: value('notes'),
    };
  }

  if (id === undefined) {
    await apiRequestV1<unknown>(`/employees/${kind}`, {
      method: 'POST',
      body,
    });
    return;
  }

  await apiRequestV1<unknown>(`/employees/${kind}/${id}`, {
    method: 'PATCH',
    body,
  });
}

/** Deletes one record under the employee's profile. */
export async function removeRecord(kind: RecordKind, id: string): Promise<void> {
  await apiRequestV1<unknown>(`/employees/${kind}/${id}`, {
    method: 'DELETE',
  });
}
