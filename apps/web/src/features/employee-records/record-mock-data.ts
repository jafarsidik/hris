import {
  buildPage,
  type EmployeeCertificationSummary,
  type EmployeeContactSummary,
  type EmployeeDocumentSummary,
  type EmployeeEducationSummary,
  type EmployeeExperienceSummary,
  type EmployeeFamilyMemberSummary,
  type EmployeeSkillSummary,
  normalisePageParams,
  resolveCursor,
  cursorFingerprint,
} from '@hris/shared-types';

/** Deterministic employee sub-record rows mirroring the API contract. */
const CONTACTS: readonly EmployeeContactSummary[] = Object.freeze([
  {
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    id: 'ct-0001',
    name: 'Maria Reyes',
    relationship: 'Spouse',
    phone: '+62 812 1111 0001',
    email: 'maria.reyes@example.com',
    address: 'Jakarta',
    isPrimary: true,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    employeeId: 'emp-0002',
    employeeName: 'Adeyemi Bergman',
    employeeNumber: 'EMP-0002',
    id: 'ct-0002',
    name: 'Samuel Okafor',
    relationship: 'Brother',
    phone: '+62 812 1111 0002',
    email: null,
    address: 'Bandung',
    isPrimary: false,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
] as const);

const FAMILY: readonly EmployeeFamilyMemberSummary[] = Object.freeze([
  {
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    id: 'fam-0001',
    fullName: 'Maria Reyes',
    relationship: 'Spouse',
    birthDate: '1992-04-11T00:00:00Z',
    occupation: 'Teacher',
    isDependent: true,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    id: 'fam-0002',
    fullName: 'Lucas Reyes',
    relationship: 'Child',
    birthDate: '2018-09-30T00:00:00Z',
    occupation: null,
    isDependent: true,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    employeeId: 'emp-0002',
    employeeName: 'Adeyemi Bergman',
    employeeNumber: 'EMP-0002',
    id: 'fam-0003',
    fullName: 'Grace Adeyemi',
    relationship: 'Parent',
    birthDate: '1968-01-20T00:00:00Z',
    occupation: 'Retired',
    isDependent: false,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
] as const);

const EDUCATION: readonly EmployeeEducationSummary[] = Object.freeze([
  {
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    id: 'edu-0001',
    level: 'BACHELOR',
    institution: 'Universitas Indonesia',
    major: 'Computer Science',
    startYear: 2014,
    endYear: 2018,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    employeeId: 'emp-0002',
    employeeName: 'Adeyemi Bergman',
    employeeNumber: 'EMP-0002',
    id: 'edu-0002',
    level: 'MASTER',
    institution: 'Universitas Gadjah Mada',
    major: 'Human Resources',
    startYear: 2016,
    endYear: 2018,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
] as const);

const EXPERIENCE: readonly EmployeeExperienceSummary[] = Object.freeze([
  {
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    id: 'exp-0001',
    companyName: 'Tech Solutions Co.',
    positionTitle: 'Backend Developer',
    startDate: '2018-07-01T00:00:00Z',
    endDate: '2022-10-31T00:00:00Z',
    description: 'Payments and APIs.',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    employeeId: 'emp-0002',
    employeeName: 'Adeyemi Bergman',
    employeeNumber: 'EMP-0002',
    id: 'exp-0002',
    companyName: 'PeopleFirst Consulting',
    positionTitle: 'HR Officer',
    startDate: '2019-01-01T00:00:00Z',
    endDate: '2024-03-31T00:00:00Z',
    description: null,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
] as const);

const SKILLS: readonly EmployeeSkillSummary[] = Object.freeze([
  {
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    id: 'skl-0001',
    name: 'TypeScript',
    proficiency: 'EXPERT',
    yearsOfExperience: 6,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    employeeId: 'emp-0002',
    employeeName: 'Adeyemi Bergman',
    employeeNumber: 'EMP-0002',
    id: 'skl-0002',
    name: 'Recruitment Sourcing',
    proficiency: 'ADVANCED',
    yearsOfExperience: 5,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
] as const);

const CERTIFICATIONS: readonly EmployeeCertificationSummary[] = Object.freeze([
  {
    employeeId: 'emp-0002',
    employeeName: 'Adeyemi Bergman',
    employeeNumber: 'EMP-0002',
    id: 'crt-0001',
    name: 'Certified HR Professional',
    issuer: 'SHRM',
    issueDate: '2023-06-01T00:00:00Z',
    expiryDate: '2026-06-01T00:00:00Z',
    credentialId: 'SHRM-CP-48291',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
] as const);

const DOCUMENTS: readonly EmployeeDocumentSummary[] = Object.freeze([
  {
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    id: 'doc-0001',
    title: 'Permanent employment contract',
    category: 'CONTRACT',
    fileUrl: 'https://files.hris.local/emp-0001/contract-2024.pdf',
    expiryDate: null,
    note: 'Signed 2024-01-02.',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    employeeId: 'emp-0002',
    employeeName: 'Adeyemi Bergman',
    employeeNumber: 'EMP-0002',
    id: 'doc-0002',
    title: 'ID card',
    category: 'IDENTITY',
    fileUrl: null,
    expiryDate: '2030-05-01T00:00:00Z',
    note: null,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
] as const);

const SORT = { createdAt: 'desc', id: 'desc' } as const;

/** Keyset page of the mock rows, mirroring the API pagination contract. */
function page<T extends { readonly id: string; readonly createdAt: string }>(
  all: readonly T[],
): { readonly items: T[] } {
  const params = normalisePageParams({});
  const fingerprint = cursorFingerprint({ filters: {}, sort: SORT });
  const resolution = resolveCursor(undefined, fingerprint);
  if (!resolution.ok) {
    throw new Error('The pagination cursor does not match the current filters');
  }
  const rows: T[] = [...all];
  const paginated = buildPage(rows, params, fingerprint, (item) => ({
    values: [item.createdAt, item.id],
  }));
  return { items: [...paginated.items] };
}

export function mockContacts(): { readonly items: EmployeeContactSummary[] } {
  return page(CONTACTS);
}

export function mockFamily(dependentsOnly = false): {
  readonly items: EmployeeFamilyMemberSummary[];
} {
  const rows = dependentsOnly ? FAMILY.filter((f) => f.isDependent) : FAMILY;
  return page(rows);
}

export function mockEducation(): { readonly items: EmployeeEducationSummary[] } {
  return page(EDUCATION);
}

export function mockExperience(): { readonly items: EmployeeExperienceSummary[] } {
  return page(EXPERIENCE);
}

export function mockSkills(): { readonly items: EmployeeSkillSummary[] } {
  return page(SKILLS);
}

export function mockCertifications(): { readonly items: EmployeeCertificationSummary[] } {
  return page(CERTIFICATIONS);
}

export function mockDocuments(): { readonly items: EmployeeDocumentSummary[] } {
  return page(DOCUMENTS);
}
