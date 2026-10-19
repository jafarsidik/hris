/**
 * Deterministic job architecture constants — job families, levels and
 * generic profiles. Like the leave-type and shift-pattern catalogues, this
 * screen reads constants until the job endpoint ships.
 */

export interface JobFamily {
  readonly code: string;
  readonly name: string;
  readonly description: string;
}

export const JOB_FAMILIES: readonly JobFamily[] = Object.freeze([
  {
    code: 'ENG',
    name: 'Engineering & Technology',
    description: 'Software, platform, data and infrastructure roles.',
  },
  {
    code: 'PROD',
    name: 'Product & Design',
    description: 'Product management, product design and research.',
  },
  {
    code: 'COMM',
    name: 'Commercial',
    description: 'Sales, account management and customer success.',
  },
  {
    code: 'OPS',
    name: 'Business Operations',
    description: 'Support, logistics and operational delivery.',
  },
  {
    code: 'FIN',
    name: 'Finance & Legal',
    description: 'Finance, accounting, tax and corporate legal.',
  },
  {
    code: 'PEO',
    name: 'People & Culture',
    description: 'HR operations, talent acquisition and people development.',
  },
] as const);

export interface JobLevel {
  readonly code: string;
  readonly band: string;
  readonly description: string;
  readonly active: boolean;
}

export const JOB_LEVELS: readonly JobLevel[] = Object.freeze([
  {
    code: 'P1',
    band: 'Practitioner — Entry',
    description: 'Graduate and entry professional roles.',
    active: true,
  },
  {
    code: 'P2',
    band: 'Practitioner — Professional',
    description: 'Independent delivery within a domain.',
    active: true,
  },
  {
    code: 'P3',
    band: 'Practitioner — Senior',
    description: 'Deep expertise, mentors practitioners.',
    active: true,
  },
  {
    code: 'M1',
    band: 'Management — Team',
    description: 'Leads a team through others.',
    active: true,
  },
  {
    code: 'M2',
    band: 'Management — Function',
    description: 'Leads a function or several teams.',
    active: true,
  },
  {
    code: 'E1',
    band: 'Executive',
    description: 'Company-level leadership.',
    active: false,
  },
] as const);
