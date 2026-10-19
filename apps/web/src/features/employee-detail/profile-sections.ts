import type {
  EmployeeCertificationSummary,
  EmployeeContactSummary,
  EmployeeDocumentSummary,
  EmployeeEducationSummary,
  EmployeeExperienceSummary,
  EmployeeFamilyMemberSummary,
  EmployeeMovementSummary,
  EmployeeSkillSummary,
  EmploymentContractSummary,
} from '@hris/shared-types';

import { serverApiRequestV1 } from '@/lib/api/server-config';
import { sessionRequestOptions } from '@/lib/api/server-session';

import type { SectionTableProps } from './record-section';

/**
 * The profile's per-employee record sections, read from the API.
 *
 * Every section is a real query against the employee-records and employment
 * endpoints, scoped the way those endpoints scope reads. There is no client-side
 * fallback: an API failure surfaces at the error boundary and an empty result
 * renders as "No records yet" — both statements are true statements about the
 * data, and fabricating rows here would say something neither is.
 */

const PAGE_LIMIT = 100;

/** Pinned to UTC like every other date-only formatter in the app. */
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const fmt = (iso: string | null): string =>
  iso === null ? '' : dateFormatter.format(new Date(iso));

/** Native date inputs speak YYYY-MM-DD; API summaries may carry a full
 *  timestamp, so drafts get the bare date part. */
const datePart = (iso: string | null): string => (iso === null ? '' : iso.slice(0, 10));

/** Numbers arrive as numbers; inputs speak text. */
const text = (value: string | number | null): string => (value === null ? '' : String(value));

function expectRecordPage<T>(data: unknown, path: string): readonly T[] {
  if (typeof data !== 'object' || data === null || !('items' in data)) {
    throw new TypeError(`${path} response was not a record page`);
  }
  const items = (data as { items: unknown }).items;
  if (!Array.isArray(items)) {
    throw new TypeError(`${path} response carried no items array`);
  }
  return items as T[];
}

async function recordsFor<T>(path: string, employeeId: string): Promise<readonly T[]> {
  const searchParams = new URLSearchParams({ employeeId, limit: String(PAGE_LIMIT) });
  const data = await serverApiRequestV1<unknown>(
    `${path}?${searchParams.toString()}`,
    await sessionRequestOptions({ headers: { 'cache-control': 'no-store' } }),
  );
  return expectRecordPage<T>(data, path);
}

export interface ProfileSections {
  readonly employment: readonly SectionTableProps[];
  readonly personal: readonly SectionTableProps[];
}

export async function profileSectionsFor(employeeId: string): Promise<ProfileSections> {
  const [
    contacts,
    family,
    education,
    experience,
    skills,
    certifications,
    documents,
    contracts,
    movements,
  ] = await Promise.all([
    recordsFor<EmployeeContactSummary>('/employees/contacts', employeeId),
    recordsFor<EmployeeFamilyMemberSummary>('/employees/family', employeeId),
    recordsFor<EmployeeEducationSummary>('/employees/education', employeeId),
    recordsFor<EmployeeExperienceSummary>('/employees/experience', employeeId),
    recordsFor<EmployeeSkillSummary>('/employees/skills', employeeId),
    recordsFor<EmployeeCertificationSummary>('/employees/certifications', employeeId),
    recordsFor<EmployeeDocumentSummary>('/employees/documents', employeeId),
    recordsFor<EmploymentContractSummary>('/employees/contracts', employeeId),
    recordsFor<EmployeeMovementSummary>('/employees/movements', employeeId),
  ]);

  const dependents = family.filter((member) => member.isDependent);

  const employment: readonly SectionTableProps[] = [
    {
      title: 'Employment Information',
      description: 'Signed agreements behind this employment.',
      columns: ['Number', 'Type', 'Valid', 'Status', 'Signed'],
      employeeId,
      kind: 'contracts',
      rows: contracts.map((contract) => ({
        id: contract.id,
        draft: {
          contractNumber: contract.contractNumber,
          contractType: contract.contractType,
          startDate: datePart(contract.startDate),
          endDate: datePart(contract.endDate),
          status: contract.status,
          signedDate: datePart(contract.signedDate),
          notes: contract.notes ?? '',
        },
        cells: [
          contract.contractNumber,
          contract.contractType,
          `${fmt(contract.startDate)} – ${contract.endDate === null ? 'open' : fmt(contract.endDate)}`,
          contract.status,
          fmt(contract.signedDate),
        ],
      })),
    },
    {
      title: 'Movement History',
      description: 'Transfers, promotions and role changes this employee has gone through.',
      columns: ['Type', 'Effective', 'Change', 'Reason'],
      rows: movements.map((movement) => ({
        cells: [
          movement.movementType,
          fmt(movement.effectiveDate),
          describeMovement(movement),
          movement.reason ?? '',
        ],
      })),
    },
  ];

  const personal: readonly SectionTableProps[] = [
    {
      title: 'Family',
      description: 'Family members on record; dependents flag coverage eligibility.',
      columns: ['Name', 'Relationship', 'Birth date', 'Occupation', 'Dependent'],
      employeeId,
      kind: 'family',
      rows: family.map((member) => ({
        id: member.id,
        draft: {
          fullName: member.fullName,
          relationship: member.relationship,
          birthDate: datePart(member.birthDate),
          occupation: member.occupation ?? '',
          isDependent: member.isDependent,
        },
        cells: [
          member.fullName,
          member.relationship,
          fmt(member.birthDate),
          member.occupation ?? '',
          member.isDependent ? 'Yes' : 'No',
        ],
      })),
    },
    {
      title: 'Dependents',
      description: 'Family members flagged as dependents — the base for coverage eligibility.',
      columns: ['Name', 'Relationship', 'Birth date'],
      rows: dependents.map((member) => ({
        cells: [member.fullName, member.relationship, fmt(member.birthDate)],
      })),
    },
    {
      title: 'Education',
      description: 'Education history and qualifications.',
      columns: ['Level', 'Institution', 'Major', 'Years'],
      employeeId,
      kind: 'education',
      rows: education.map((entry) => ({
        id: entry.id,
        draft: {
          level: entry.level,
          institution: entry.institution,
          major: entry.major ?? '',
          startYear: String(entry.startYear),
          endYear: entry.endYear === null ? '' : String(entry.endYear),
        },
        cells: [
          entry.level,
          entry.institution,
          entry.major ?? '',
          `${entry.startYear} – ${entry.endYear ?? 'present'}`,
        ],
      })),
    },
    {
      title: 'Experience',
      description: 'Previous employment outside the company.',
      columns: ['Company', 'Position', 'Period'],
      employeeId,
      kind: 'experience',
      rows: experience.map((entry) => ({
        id: entry.id,
        draft: {
          companyName: entry.companyName,
          positionTitle: entry.positionTitle,
          startDate: datePart(entry.startDate),
          endDate: datePart(entry.endDate),
          description: entry.description ?? '',
        },
        cells: [
          entry.companyName,
          entry.positionTitle,
          `${fmt(entry.startDate)} – ${entry.endDate === null ? 'present' : fmt(entry.endDate)}`,
        ],
      })),
    },
    {
      title: 'Skills',
      description: 'Skills with proficiency levels — the base for matching and staffing.',
      columns: ['Skill', 'Proficiency', 'Experience'],
      employeeId,
      kind: 'skills',
      rows: skills.map((skill) => ({
        id: skill.id,
        draft: {
          name: skill.name,
          proficiency: skill.proficiency,
          yearsOfExperience: text(skill.yearsOfExperience),
        },
        cells: [
          skill.name,
          skill.proficiency,
          skill.yearsOfExperience === null ? '—' : `${skill.yearsOfExperience} yr`,
        ],
      })),
    },
    {
      title: 'Certifications',
      description: 'Professional certifications and their validity windows.',
      columns: ['Certification', 'Issuer', 'Issued', 'Expires'],
      employeeId,
      kind: 'certifications',
      rows: certifications.map((cert) => ({
        id: cert.id,
        draft: {
          name: cert.name,
          issuer: cert.issuer,
          issueDate: datePart(cert.issueDate),
          expiryDate: datePart(cert.expiryDate),
          credentialId: cert.credentialId ?? '',
        },
        cells: [
          cert.name,
          cert.issuer,
          fmt(cert.issueDate),
          cert.expiryDate === null ? '—' : fmt(cert.expiryDate),
        ],
      })),
    },
    {
      title: 'Employee Documents',
      description: 'Contracts, certificates and HR documents with expiry tracking.',
      columns: ['Title', 'Category', 'Expires', 'Note'],
      employeeId,
      kind: 'documents',
      rows: documents.map((document) => ({
        id: document.id,
        draft: {
          title: document.title,
          category: document.category,
          fileUrl: document.fileUrl ?? '',
          expiryDate: datePart(document.expiryDate),
          note: document.note ?? '',
        },
        cells: [
          document.title,
          document.category,
          document.expiryDate === null ? '—' : fmt(document.expiryDate),
          document.note ?? '',
        ],
      })),
    },
    {
      title: 'Emergency Contacts',
      description: 'Who to call for this employee in an emergency.',
      columns: ['Name', 'Relationship', 'Phone', 'Email', 'Priority'],
      employeeId,
      kind: 'contacts',
      rows: contacts.map((contact) => ({
        id: contact.id,
        draft: {
          name: contact.name,
          relationship: contact.relationship,
          phone: contact.phone,
          email: contact.email ?? '',
          address: contact.address ?? '',
          isPrimary: contact.isPrimary,
        },
        cells: [
          contact.name,
          contact.relationship,
          contact.phone,
          contact.email ?? '',
          contact.isPrimary ? 'Primary' : '—',
        ],
      })),
    },
  ];

  return { employment, personal };
}

function describeMovement(value: EmployeeMovementSummary): string {
  const unit =
    value.fromUnitName !== value.toUnitName && value.toUnitName !== null ? value.toUnitName : null;
  const position =
    value.fromPositionName !== value.toPositionName && value.toPositionName !== null
      ? value.toPositionName
      : null;
  return [position, unit].filter((part) => part !== null).join(' · ');
}
