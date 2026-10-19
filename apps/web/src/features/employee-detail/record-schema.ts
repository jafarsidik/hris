import type { RecordKind } from './record-mutations';

/**
 * The one schema per record kind — the single source of truth the dialogs and
 * the (server) sections both shape themselves around: field list, labels,
 * enums and the section's human title.
 *
 * A field's `name` is the API body field verbatim, so {@link saveRecord} can
 * post the draft without a second mapping layer.
 */
export interface RecordFieldDef {
  readonly name: string;
  readonly label: string;
  readonly type: 'text' | 'date' | 'number' | 'checkbox' | 'select' | 'textarea';
  readonly required?: boolean;
  readonly options?: readonly string[];
  readonly hint?: string;
}

export interface RecordSchema {
  readonly kind: RecordKind;
  /** Section title as the section already shows it. */
  readonly title: string;
  /** One row, for the add/edit dialog headings ("Add contact", "Edit contact"). */
  readonly singular: string;
  readonly fields: readonly RecordFieldDef[];
}

/**
 * Selects use the same vocabulary the API validates with `@IsIn`, spelled as
 * the UI shows it. Offers are static constants: the record's field is
 * enumerative by contract, not derived from data.
 */
export const RECORD_SCHEMAS = {
  contacts: {
    kind: 'contacts',
    title: 'Emergency Contacts',
    singular: 'contact',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'relationship', label: 'Relationship', type: 'text', required: true },
      { name: 'phone', label: 'Phone', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'address', label: 'Address', type: 'text' },
      { name: 'isPrimary', label: 'Primary contact', type: 'checkbox' },
    ],
  },
  family: {
    kind: 'family',
    title: 'Family',
    singular: 'family member',
    fields: [
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      {
        name: 'relationship',
        label: 'Relationship',
        type: 'text',
        required: true,
        hint: 'e.g. Spouse, Child, Parent',
      },
      { name: 'birthDate', label: 'Birth date', type: 'date' },
      { name: 'occupation', label: 'Occupation', type: 'text' },
      { name: 'isDependent', label: 'Dependent (coverage eligibility)', type: 'checkbox' },
    ],
  },
  education: {
    kind: 'education',
    title: 'Education',
    singular: 'education record',
    fields: [
      {
        name: 'level',
        label: 'Level',
        type: 'select',
        required: true,
        options: ['HIGH_SCHOOL', 'DIPLOMA', 'BACHELOR', 'MASTER', 'DOCTORATE'],
      },
      { name: 'institution', label: 'Institution', type: 'text', required: true },
      { name: 'major', label: 'Major', type: 'text' },
      { name: 'startYear', label: 'Start year', type: 'number', required: true },
      { name: 'endYear', label: 'End year', type: 'number' },
    ],
  },
  experience: {
    kind: 'experience',
    title: 'Experience',
    singular: 'experience record',
    fields: [
      { name: 'companyName', label: 'Company', type: 'text', required: true },
      { name: 'positionTitle', label: 'Position', type: 'text', required: true },
      { name: 'startDate', label: 'Start date', type: 'date', required: true },
      { name: 'endDate', label: 'End date', type: 'date' },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  skills: {
    kind: 'skills',
    title: 'Skills',
    singular: 'skill',
    fields: [
      { name: 'name', label: 'Skill', type: 'text', required: true },
      {
        name: 'proficiency',
        label: 'Proficiency',
        type: 'select',
        required: true,
        options: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'],
      },
      { name: 'yearsOfExperience', label: 'Years of experience', type: 'number' },
    ],
  },
  certifications: {
    kind: 'certifications',
    title: 'Certifications',
    singular: 'certification',
    fields: [
      { name: 'name', label: 'Certification', type: 'text', required: true },
      { name: 'issuer', label: 'Issuer', type: 'text', required: true },
      { name: 'issueDate', label: 'Issued', type: 'date', required: true },
      { name: 'expiryDate', label: 'Expires', type: 'date' },
      { name: 'credentialId', label: 'Credential ID', type: 'text' },
    ],
  },
  documents: {
    kind: 'documents',
    title: 'Employee Documents',
    singular: 'document',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        required: true,
        options: ['CONTRACT', 'CERTIFICATE', 'IDENTITY', 'TAX', 'OTHER'],
      },
      { name: 'fileUrl', label: 'File URL', type: 'text' },
      { name: 'expiryDate', label: 'Expires', type: 'date' },
      { name: 'note', label: 'Note', type: 'textarea' },
    ],
  },
  contracts: {
    kind: 'contracts',
    title: 'Contracts',
    singular: 'contract',
    fields: [
      { name: 'contractNumber', label: 'Contract number', type: 'text', required: true },
      {
        name: 'contractType',
        label: 'Type',
        type: 'select',
        required: true,
        options: ['PERMANENT', 'FIXED_TERM', 'PROBATION', 'INTERNSHIP'],
      },
      { name: 'startDate', label: 'Start date', type: 'date', required: true },
      { name: 'endDate', label: 'End date', type: 'date' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        options: ['ACTIVE', 'EXPIRED', 'TERMINATED'],
      },
      { name: 'signedDate', label: 'Signed on', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
} as const satisfies Record<RecordKind, RecordSchema>;

export const recordSchemaFor = (kind: RecordKind): RecordSchema => RECORD_SCHEMAS[kind];
