import { MODULE_IDS, type ModuleId } from '@hris/shared-types';
import {
  Banknote,
  CalendarClock,
  ChartNoAxesCombined,
  Gauge,
  Handshake,
  KeyRound,
  Receipt,
  Settings2,
  Target,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * Navigation model for the web tier.
 *
 * The shape is module → group → item, which mirrors how the platform is actually
 * organised: `ModuleId` is the same vocabulary the API and the audit log use, so the
 * sidebar is a view of the module map rather than a separate list that can drift from it.
 *
 * **Only `built` items carry an `href`.** A menu entry pointing at a route that does not
 * exist is worse than no entry: it advertises a capability the product does not have,
 * and it turns a click into a 404. Planned items are described and rendered as text.
 * That rule is what keeps the sidebar honest, and it is why `href` is optional rather
 * than merely empty.
 *
 * `MODULE_MENUS` is derived from `MODULE_IDS`, so a module added to the shared contract
 * appears in the rail without anyone remembering to update the sidebar. Anything the
 * product intends to sell but has not built stays visible as scope, which is more useful
 * to a reader than an entry that fails.
 */

export type { ModuleId } from '@hris/shared-types';

export type MenuStatus = 'built' | 'planned';

export interface MenuItem {
  readonly label: string;
  /** Used as the accessible title and the collapsed tooltip. */
  readonly description: string;
  /** Present only when the route exists. */
  readonly href?: string;
  readonly status: MenuStatus;
}

export interface MenuGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly MenuItem[];
}

export interface ModuleMenu {
  readonly module: ModuleId;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly groups: readonly MenuGroup[];
  /** True when at least one item in this module is `built`. Derived, never restated. */
  readonly hasSurface: boolean;
}

/** Human labels for the module identifiers shared with the API and the audit log. */
const MODULE_META: Readonly<
  Record<ModuleId, { label: string; description: string; icon: LucideIcon }>
> = {
  M00_AUTHENTICATION: {
    label: 'Identity & Access',
    description: 'Authentication, authorization, roles and security',
    icon: KeyRound,
  },

  M01_CORE_HR: {
    label: 'Core HR',
    description: 'Employee master data, organization and employment lifecycle',
    icon: Users,
  },

  M02_INDUSTRIAL_RELATIONS: {
    label: 'Industrial Relations',
    description: 'Employment relations, contracts, grievances and disciplinary matters',
    icon: Handshake,
  },

  M03_RECRUITMENT: {
    label: 'Recruitment',
    description: 'Workforce requests, candidates, hiring and talent acquisition',
    icon: UserPlus,
  },

  M04_PERFORMANCE: {
    label: 'Performance',
    description: 'Goals, KPIs, appraisal, feedback and performance management',
    icon: Target,
  },

  M05_CLAIMS: {
    label: 'Claims & Benefits',
    description: 'Leave, reimbursement, employee benefits and claims',
    icon: Receipt,
  },

  M06_PAYROLL: {
    label: 'Payroll',
    description: 'Payroll processing, compensation, taxation and statutory reporting',
    icon: Banknote,
  },

  M07_ADMINISTRATION: {
    label: 'Administration',
    description: 'Company setup, organization, workflow and HR configuration',
    icon: Settings2,
  },

  M08_ATTENDANCE: {
    label: 'Attendance & Time',
    description: 'Attendance, shifts, rosters, overtime and working time',
    icon: CalendarClock,
  },

  M09_AI_ANALYTICS: {
    label: 'AI & Analytics',
    description: 'Workforce intelligence, HR analytics, forecasting and AI insights',
    icon: ChartNoAxesCombined,
  },

  PLATFORM: {
    label: 'Platform',
    description: 'Platform health, monitoring, jobs and operational status',
    icon: Gauge,
  },
};

export const moduleLabel = (module: ModuleId): string => MODULE_META[module].label;

/**
 * The group and item definitions for each module, keyed by `ModuleId`.
 *
 * Keyed rather than listed so that `MODULE_MENUS` below can enforce completeness: a
 * module in `MODULE_IDS` with no entry here is a compile error, not a silently missing
 * rail entry.
 */
const MODULE_GROUPS: Readonly<Record<ModuleId, readonly MenuGroup[]>> = {
  /**
   * ============================================================
   * M00 - IDENTITY & ACCESS
   * ============================================================
   */
  M00_AUTHENTICATION: [
    {
      id: 'M00_IDENTITY',
      label: 'Identity',
      items: [
        {
          label: 'Sign In',
          description: 'Password, passkey and enterprise sign-in',
          status: 'planned',
        },
        {
          label: 'My Account',
          description: 'Personal account and security settings',
          status: 'planned',
        },
        {
          label: 'Sessions',
          description: 'Active sessions and login devices',
          status: 'planned',
        },
      ],
    },
    {
      id: 'M00_ACCESS',
      label: 'Access Management',
      items: [
        {
          label: 'Users',
          description: 'System users and employee accounts',
          status: 'planned',
        },
        {
          label: 'Roles',
          description: 'Role definitions and access profiles',
          status: 'planned',
        },
        {
          label: 'Permissions',
          description: 'Fine-grained permissions and data access',
          status: 'planned',
        },
        {
          label: 'Approval Authority',
          description: 'Approval limits and delegation authority',
          status: 'planned',
        },
      ],
    },
    {
      id: 'M00_SECURITY',
      label: 'Security',
      items: [
        {
          label: 'MFA',
          description: 'Multi-factor authentication configuration',
          status: 'planned',
        },
        {
          label: 'SSO',
          description: 'Enterprise SSO and identity provider integration',
          status: 'planned',
        },
        {
          label: 'Login History',
          description: 'Authentication and login activity',
          status: 'planned',
        },
        {
          label: 'Security Audit',
          description: 'Security events and access audit trail',
          status: 'planned',
        },
      ],
    },
  ],

  /**
   * ============================================================
   * M01 - CORE HR
   * ============================================================
   */
  M01_CORE_HR: [
    {
      id: 'M01_WORKFORCE',
      label: 'Workforce',
      items: [
        {
          label: 'Employees',
          description: 'Employee master directory',
          href: '/employees',
          status: 'built',
        },
        {
          label: 'Employee Directory',
          description: 'Search and browse the organizational workforce',
          status: 'planned',
        },
        {
          label: 'Employee Documents',
          description: 'Employee contracts, certificates and HR documents',
          status: 'planned',
        },
        {
          label: 'Dependents',
          description: 'Employee spouse, children and dependent records',
          status: 'planned',
        },
        {
          label: 'Emergency Contacts',
          description: 'Emergency contact information',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M01_ORGANIZATION',
      label: 'Organization',
      items: [
        {
          label: 'Organization Structure',
          description: 'Company and organizational hierarchy',
          status: 'planned',
        },
        {
          label: 'Departments',
          description: 'Departments and organizational units',
          status: 'planned',
        },
        {
          label: 'Positions',
          description: 'Position master and position assignments',
          status: 'planned',
        },
        {
          label: 'Jobs',
          description: 'Job families, job levels and job profiles',
          status: 'planned',
        },
        {
          label: 'Locations',
          description: 'Work locations and office sites',
          status: 'planned',
        },
        {
          label: 'Org Chart',
          description: 'Interactive organization hierarchy',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M01_EMPLOYMENT',
      label: 'Employment',
      items: [
        {
          label: 'Employment Information',
          description: 'Employment status and relationship details',
          status: 'planned',
        },
        {
          label: 'Contracts',
          description: 'Employment agreements and contract history',
          status: 'planned',
        },
        {
          label: 'Probation',
          description: 'Probation monitoring and confirmation',
          status: 'planned',
        },
        {
          label: 'Transfers',
          description: 'Employee transfers between organizations or locations',
          status: 'planned',
        },
        {
          label: 'Promotions',
          description: 'Promotion and job level changes',
          status: 'planned',
        },
        {
          label: 'Employment History',
          description: 'Complete employment movement history',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M01_PERSONAL',
      label: 'Employee Data',
      items: [
        {
          label: 'Personal Information',
          description: 'Identity and personal employee information',
          status: 'planned',
        },
        {
          label: 'Family',
          description: 'Family and household information',
          status: 'planned',
        },
        {
          label: 'Education',
          description: 'Education history and qualifications',
          status: 'planned',
        },
        {
          label: 'Experience',
          description: 'Previous employment and professional experience',
          status: 'planned',
        },
        {
          label: 'Skills',
          description: 'Employee skills and proficiency levels',
          status: 'planned',
        },
        {
          label: 'Certifications',
          description: 'Professional certifications and validity',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M01_LIFECYCLE',
      label: 'Employee Lifecycle',
      items: [
        {
          label: 'Onboarding',
          description: 'New employee onboarding process',
          status: 'planned',
        },
        {
          label: 'Employee Movement',
          description: 'Transfers, promotions and organizational movement',
          status: 'planned',
        },
        {
          label: 'Offboarding',
          description: 'Employee exit and separation process',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M01_REPORTS',
      label: 'Reports',
      items: [
        {
          label: 'Headcount',
          description: 'Headcount by company, department and location',
          status: 'planned',
        },
        {
          label: 'Employee Movement',
          description: 'Employee movement and workforce changes',
          status: 'planned',
        },
        {
          label: 'Employee Turnover',
          description: 'Turnover and retention reporting',
          status: 'planned',
        },
        {
          label: 'Workforce Report',
          description: 'Comprehensive workforce reporting',
          status: 'planned',
        },
      ],
    },
  ],

  /**
   * ============================================================
   * M02 - INDUSTRIAL RELATIONS
   * ============================================================
   */
  M02_INDUSTRIAL_RELATIONS: [
    {
      id: 'M02_EMPLOYMENT_RELATIONS',
      label: 'Employment Relations',
      items: [
        {
          label: 'Employment Contracts',
          description: 'Employment contracts and legal terms',
          status: 'planned',
        },
        {
          label: 'Contract Renewals',
          description: 'Contract expiration and renewal management',
          status: 'planned',
        },
        {
          label: 'Collective Agreements',
          description: 'Collective labor agreements and terms',
          status: 'planned',
        },
        {
          label: 'Policies',
          description: 'HR and employment policies',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M02_EMPLOYEE_RELATIONS',
      label: 'Employee Relations',
      items: [
        {
          label: 'Employee Cases',
          description: 'Employee relations cases',
          status: 'planned',
        },
        {
          label: 'Grievances',
          description: 'Employee complaints and grievances',
          status: 'planned',
        },
        {
          label: 'Investigations',
          description: 'Employee case investigations',
          status: 'planned',
        },
        {
          label: 'Counseling',
          description: 'Employee counseling records',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M02_DISCIPLINARY',
      label: 'Disciplinary',
      items: [
        {
          label: 'Disciplinary Cases',
          description: 'Employee disciplinary cases',
          status: 'planned',
        },
        {
          label: 'Warning Letters',
          description: 'Warning letters and disciplinary actions',
          status: 'planned',
        },
        {
          label: 'Sanctions',
          description: 'Disciplinary sanctions and outcomes',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M02_LABOR',
      label: 'Labor Relations',
      items: [
        {
          label: 'Labor Union',
          description: 'Union and employee representative information',
          status: 'planned',
        },
        {
          label: 'Labor Cases',
          description: 'Labor disputes and legal cases',
          status: 'planned',
        },
        {
          label: 'Case Outcomes',
          description: 'Settlement and dispute outcomes',
          status: 'planned',
        },
      ],
    },
  ],

  /**
   * ============================================================
   * M03 - RECRUITMENT / ATS
   * ============================================================
   */
  M03_RECRUITMENT: [
    {
      id: 'M03_WORKFORCE_REQUEST',
      label: 'Workforce Request',
      items: [
        {
          label: 'Manpower Planning',
          description: 'Planned workforce demand',
          status: 'planned',
        },
        {
          label: 'Job Requisitions',
          description: 'Open position requests',
          status: 'planned',
        },
        {
          label: 'Requisition Approval',
          description: 'Recruitment request approval workflow',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M03_CANDIDATES',
      label: 'Candidates',
      items: [
        {
          label: 'Candidate Pool',
          description: 'Candidate database and talent pool',
          status: 'planned',
        },
        {
          label: 'Applications',
          description: 'Candidate applications and pipeline',
          status: 'planned',
        },
        {
          label: 'Screening',
          description: 'Candidate screening and qualification',
          status: 'planned',
        },
        {
          label: 'Talent Pool',
          description: 'Potential candidates for future hiring',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M03_HIRING',
      label: 'Hiring Process',
      items: [
        {
          label: 'Interviews',
          description: 'Interview scheduling and evaluation',
          status: 'planned',
        },
        {
          label: 'Assessments',
          description: 'Candidate tests and assessments',
          status: 'planned',
        },
        {
          label: 'Reference Checks',
          description: 'Candidate reference verification',
          status: 'planned',
        },
        {
          label: 'Background Checks',
          description: 'Pre-employment background verification',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M03_OFFER',
      label: 'Offer',
      items: [
        {
          label: 'Salary Proposal',
          description: 'Compensation proposal for candidates',
          status: 'planned',
        },
        {
          label: 'Offer Letters',
          description: 'Employment offer management',
          status: 'planned',
        },
        {
          label: 'Offer Approval',
          description: 'Offer approval workflow',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M03_REPORTS',
      label: 'Recruitment Analytics',
      items: [
        {
          label: 'Recruitment Funnel',
          description: 'Candidate pipeline conversion analysis',
          status: 'planned',
        },
        {
          label: 'Time to Hire',
          description: 'Recruitment cycle time analysis',
          status: 'planned',
        },
        {
          label: 'Cost per Hire',
          description: 'Recruitment cost analysis',
          status: 'planned',
        },
        {
          label: 'Source Effectiveness',
          description: 'Hiring source performance',
          status: 'planned',
        },
      ],
    },
  ],

  /**
   * ============================================================
   * M04 - PERFORMANCE
   * ============================================================
   */
  M04_PERFORMANCE: [
    {
      id: 'M04_CYCLE',
      label: 'Performance Cycle',
      items: [
        {
          label: 'Performance Cycles',
          description: 'Annual and periodic performance cycles',
          status: 'planned',
        },
        {
          label: 'Performance Forms',
          description: 'Performance evaluation templates',
          status: 'planned',
        },
        {
          label: 'Review Schedule',
          description: 'Performance review calendar',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M04_GOALS',
      label: 'Goals & KPI',
      items: [
        {
          label: 'Goals',
          description: 'Employee and organizational objectives',
          status: 'planned',
        },
        {
          label: 'OKR',
          description: 'Objectives and key results',
          status: 'planned',
        },
        {
          label: 'KPI',
          description: 'Key performance indicators',
          status: 'planned',
        },
        {
          label: 'KPI Library',
          description: 'Reusable KPI definitions and metrics',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M04_FEEDBACK',
      label: 'Feedback',
      items: [
        {
          label: 'Manager Feedback',
          description: 'Continuous manager feedback',
          status: 'planned',
        },
        {
          label: '360° Feedback',
          description: 'Multi-source employee feedback',
          status: 'planned',
        },
        {
          label: 'Peer Feedback',
          description: 'Peer review and collaboration feedback',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M04_REVIEW',
      label: 'Appraisal',
      items: [
        {
          label: 'Reviews',
          description: 'Performance reviews and outcomes',
          status: 'planned',
        },
        {
          label: 'Calibration',
          description: 'Cross-team performance calibration',
          status: 'planned',
        },
        {
          label: 'Performance Improvement',
          description: 'Performance improvement plans',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M04_REPORTS',
      label: 'Reports',
      items: [
        {
          label: 'Performance Dashboard',
          description: 'Performance overview',
          status: 'planned',
        },
        {
          label: 'KPI Achievement',
          description: 'KPI achievement analysis',
          status: 'planned',
        },
        {
          label: 'Performance Distribution',
          description: 'Performance distribution and calibration',
          status: 'planned',
        },
      ],
    },
  ],

  /**
   * ============================================================
   * M05 - CLAIMS, LEAVE & BENEFITS
   * ============================================================
   */
  M05_CLAIMS: [
    {
      id: 'M05_LEAVE',
      label: 'Leave',
      items: [
        {
          label: 'Leave Requests',
          description: 'Employee leave requests and approvals',
          status: 'planned',
        },
        {
          label: 'Leave Types',
          description: 'Leave type definitions',
          status: 'planned',
        },
        {
          label: 'Leave Policies',
          description: 'Leave entitlement policies',
          status: 'planned',
        },
        {
          label: 'Leave Balances',
          description: 'Employee leave balances',
          status: 'planned',
        },
        {
          label: 'Holiday Calendar',
          description: 'Company and public holiday calendar',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M05_REIMBURSEMENT',
      label: 'Reimbursement',
      items: [
        {
          label: 'Expense Claims',
          description: 'Employee expense claims',
          status: 'planned',
        },
        {
          label: 'Medical Claims',
          description: 'Employee medical reimbursement',
          status: 'planned',
        },
        {
          label: 'Travel Claims',
          description: 'Travel-related reimbursement',
          status: 'planned',
        },
        {
          label: 'Claim Approval',
          description: 'Claim approval workflow',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M05_BENEFITS',
      label: 'Benefits',
      items: [
        {
          label: 'Benefit Plans',
          description: 'Employee benefit plans',
          status: 'planned',
        },
        {
          label: 'Insurance',
          description: 'Employee insurance and coverage',
          status: 'planned',
        },
        {
          label: 'Benefit Enrollment',
          description: 'Employee benefit enrollment',
          status: 'planned',
        },
      ],
    },
  ],

  /**
   * ============================================================
   * M06 - PAYROLL
   * ============================================================
   */
  M06_PAYROLL: [
    {
      id: 'M06_PROCESSING',
      label: 'Payroll Processing',
      items: [
        {
          label: 'Payroll Period',
          description: 'Payroll periods and calendars',
          status: 'planned',
        },
        {
          label: 'Payroll Run',
          description: 'Payroll calculation and processing',
          status: 'planned',
        },
        {
          label: 'Payroll Approval',
          description: 'Payroll review and approval',
          status: 'planned',
        },
        {
          label: 'Payroll Finalization',
          description: 'Finalize and lock payroll results',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M06_COMPENSATION',
      label: 'Compensation',
      items: [
        {
          label: 'Salary Structure',
          description: 'Salary structures and grades',
          status: 'planned',
        },
        {
          label: 'Salary Components',
          description: 'Earnings and salary components',
          status: 'planned',
        },
        {
          label: 'Allowances',
          description: 'Fixed and variable allowances',
          status: 'planned',
        },
        {
          label: 'Deductions',
          description: 'Payroll deductions',
          status: 'planned',
        },
        {
          label: 'Overtime',
          description: 'Overtime payroll calculation',
          status: 'planned',
        },
        {
          label: 'Bonus',
          description: 'Bonus and incentive payments',
          status: 'planned',
        },
        {
          label: 'THR',
          description: 'Religious holiday allowance processing',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M06_TAX',
      label: 'Tax & Statutory',
      items: [
        {
          label: 'PPh 21',
          description: 'Indonesian employee income tax',
          status: 'planned',
        },
        {
          label: 'BPJS Kesehatan',
          description: 'Health insurance statutory contribution',
          status: 'planned',
        },
        {
          label: 'BPJS Ketenagakerjaan',
          description: 'Employment social security contribution',
          status: 'planned',
        },
        {
          label: 'Tax Reporting',
          description: 'Payroll tax reporting',
          status: 'planned',
        },
        {
          label: 'Statutory Reporting',
          description: 'Government statutory payroll reporting',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M06_PAYMENT',
      label: 'Payment',
      items: [
        {
          label: 'Bank Transfer',
          description: 'Employee payroll bank transfer',
          status: 'planned',
        },
        {
          label: 'Payment File',
          description: 'Generate bank payment files',
          status: 'planned',
        },
        {
          label: 'Payment Reconciliation',
          description: 'Reconcile payroll payments',
          status: 'planned',
        },
        {
          label: 'Payslips',
          description: 'Generate and distribute employee payslips',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M06_REPORTS',
      label: 'Payroll Reports',
      items: [
        {
          label: 'Payroll Register',
          description: 'Detailed payroll register',
          status: 'planned',
        },
        {
          label: 'Payroll Cost',
          description: 'Payroll cost by organization',
          status: 'planned',
        },
        {
          label: 'Tax Report',
          description: 'Payroll tax reporting',
          status: 'planned',
        },
        {
          label: 'Statutory Report',
          description: 'Government contribution reporting',
          status: 'planned',
        },
      ],
    },
  ],

  /**
   * ============================================================
   * M07 - ADMINISTRATION
   * ============================================================
   */
  M07_ADMINISTRATION: [
    {
      id: 'M07_COMPANY',
      label: 'Organization Setup',
      items: [
        {
          label: 'Company',
          description: 'Legal entities and company settings',
          status: 'planned',
        },
        {
          label: 'Business Units',
          description: 'Business units and organizational segments',
          status: 'planned',
        },
        {
          label: 'Branches',
          description: 'Branches and locations',
          status: 'planned',
        },
        {
          label: 'Departments',
          description: 'Department configuration',
          status: 'planned',
        },
        {
          label: 'Cost Centers',
          description: 'Cost center configuration',
          status: 'planned',
        },
        {
          label: 'Locations',
          description: 'Office and operational locations',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M07_JOB',
      label: 'Job Architecture',
      items: [
        {
          label: 'Job Families',
          description: 'Job family definitions',
          status: 'planned',
        },
        {
          label: 'Job Levels',
          description: 'Job grades and organizational levels',
          status: 'planned',
        },
        {
          label: 'Job Profiles',
          description: 'Job descriptions and requirements',
          status: 'planned',
        },
        {
          label: 'Positions',
          description: 'Position master and budget',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M07_WORKFLOW',
      label: 'Workflow',
      items: [
        {
          label: 'Approval Workflow',
          description: 'HR approval workflows',
          status: 'planned',
        },
        {
          label: 'Approval Matrix',
          description: 'Approval hierarchy and authority',
          status: 'planned',
        },
        {
          label: 'Delegation',
          description: 'Temporary approval delegation',
          status: 'planned',
        },
        {
          label: 'Notifications',
          description: 'HR notifications and reminders',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M07_CONFIGURATION',
      label: 'HR Configuration',
      items: [
        {
          label: 'HR Policies',
          description: 'HR policy configuration',
          status: 'planned',
        },
        {
          label: 'Numbering',
          description: 'Document numbering configuration',
          status: 'planned',
        },
        {
          label: 'Document Templates',
          description: 'HR document and letter templates',
          status: 'planned',
        },
        {
          label: 'System Parameters',
          description: 'HR system configuration',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M07_INTEGRATION',
      label: 'Integration',
      items: [
        {
          label: 'ERP Integration',
          description: 'Integration with finance and ERP systems',
          status: 'planned',
        },
        {
          label: 'Bank Integration',
          description: 'Payroll and banking integration',
          status: 'planned',
        },
        {
          label: 'Biometric Integration',
          description: 'Attendance device integration',
          status: 'planned',
        },
        {
          label: 'API & Webhooks',
          description: 'External API and webhook configuration',
          status: 'planned',
        },
      ],
    },
  ],

  /**
   * ============================================================
   * M08 - ATTENDANCE & TIME
   * ============================================================
   */
  M08_ATTENDANCE: [
    {
      id: 'M08_ATTENDANCE',
      label: 'Attendance',
      items: [
        {
          label: 'Attendance',
          description: 'Daily employee attendance records',
          status: 'planned',
        },
        {
          label: 'Attendance Correction',
          description: 'Attendance correction requests',
          status: 'planned',
        },
        {
          label: 'Attendance Approval',
          description: 'Attendance verification and approval',
          status: 'planned',
        },
        {
          label: 'Attendance Monitoring',
          description: 'Real-time workforce attendance monitoring',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M08_SHIFT',
      label: 'Shift & Roster',
      items: [
        {
          label: 'Shift Patterns',
          description: 'Shift pattern definitions',
          status: 'planned',
        },
        {
          label: 'Shift Assignment',
          description: 'Employee shift assignment',
          status: 'planned',
        },
        {
          label: 'Roster',
          description: 'Workforce roster planning',
          status: 'planned',
        },
        {
          label: 'Shift Swap',
          description: 'Employee shift exchange requests',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M08_WORKING_TIME',
      label: 'Working Time',
      items: [
        {
          label: 'Work Schedule',
          description: 'Employee working schedules',
          status: 'planned',
        },
        {
          label: 'Timesheets',
          description: 'Employee working time records',
          status: 'planned',
        },
        {
          label: 'Overtime',
          description: 'Overtime requests and calculation',
          status: 'planned',
        },
        {
          label: 'Remote Work',
          description: 'Remote and flexible work management',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M08_DEVICE',
      label: 'Attendance Devices',
      items: [
        {
          label: 'Biometric Devices',
          description: 'Biometric attendance device management',
          status: 'planned',
        },
        {
          label: 'Device Logs',
          description: 'Raw attendance device logs',
          status: 'planned',
        },
        {
          label: 'Sync Monitoring',
          description: 'Attendance synchronization monitoring',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M08_REPORTS',
      label: 'Reports',
      items: [
        {
          label: 'Attendance Report',
          description: 'Attendance summary and detail',
          status: 'planned',
        },
        {
          label: 'Late & Early Report',
          description: 'Late arrival and early departure analysis',
          status: 'planned',
        },
        {
          label: 'Absence Report',
          description: 'Employee absence analysis',
          status: 'planned',
        },
        {
          label: 'Overtime Report',
          description: 'Overtime analysis and cost',
          status: 'planned',
        },
      ],
    },
  ],

  /**
   * ============================================================
   * M09 - AI & ANALYTICS
   * ============================================================
   */
  M09_AI_ANALYTICS: [
    {
      id: 'M09_EXECUTIVE',
      label: 'Executive Intelligence',
      items: [
        {
          label: 'HR Command Center',
          description: 'Executive HR command center',
          status: 'planned',
        },
        {
          label: 'Executive Dashboard',
          description: 'Executive workforce overview',
          status: 'planned',
        },
        {
          label: 'Workforce Overview',
          description: 'Enterprise workforce intelligence',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M09_WORKFORCE',
      label: 'Workforce Analytics',
      items: [
        {
          label: 'Headcount Analytics',
          description: 'Headcount trends and workforce composition',
          status: 'planned',
        },
        {
          label: 'Turnover Analytics',
          description: 'Employee turnover and retention analysis',
          status: 'planned',
        },
        {
          label: 'Absence Analytics',
          description: 'Absence and attendance analytics',
          status: 'planned',
        },
        {
          label: 'Workforce Cost',
          description: 'Total workforce cost analysis',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M09_RECRUITMENT',
      label: 'Recruitment Analytics',
      items: [
        {
          label: 'Recruitment Funnel',
          description: 'Recruitment pipeline analytics',
          status: 'planned',
        },
        {
          label: 'Time to Hire',
          description: 'Recruitment cycle analysis',
          status: 'planned',
        },
        {
          label: 'Cost per Hire',
          description: 'Recruitment cost analytics',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M09_PEOPLE',
      label: 'People Analytics',
      items: [
        {
          label: 'Performance Analytics',
          description: 'Employee performance analytics',
          status: 'planned',
        },
        {
          label: 'Learning Analytics',
          description: 'Training and capability analytics',
          status: 'planned',
        },
        {
          label: 'Compensation Analytics',
          description: 'Salary and compensation analysis',
          status: 'planned',
        },
        {
          label: 'Diversity Analytics',
          description: 'Workforce diversity analytics',
          status: 'planned',
        },
      ],
    },

    {
      id: 'M09_AI',
      label: 'AI Intelligence',
      items: [
        {
          label: 'Attrition Prediction',
          description: 'Employee retention risk prediction',
          status: 'planned',
        },
        {
          label: 'Workforce Forecast',
          description: 'Headcount and workforce cost forecasting',
          status: 'planned',
        },
        {
          label: 'Salary Benchmark',
          description: 'Compensation benchmarking intelligence',
          status: 'planned',
        },
        {
          label: 'AI HR Assistant',
          description: 'Conversational HR assistant',
          status: 'planned',
        },
        {
          label: 'HR Insights',
          description: 'AI-generated HR insights and recommendations',
          status: 'planned',
        },
      ],
    },
  ],

  /**
   * ============================================================
   * PLATFORM
   * ============================================================
   */
  PLATFORM: [
    {
      id: 'PLATFORM_MONITORING',
      label: 'Monitoring',
      items: [
        {
          label: 'Overview',
          description: 'What the platform foundation delivers',
          href: '/',
          status: 'built',
        },
        {
          label: 'Health',
          description: 'Live dependency probes',
          href: '/status',
          status: 'built',
        },
        {
          label: 'System Activity',
          description: 'Platform activity and operational events',
          status: 'planned',
        },
        {
          label: 'Background Jobs',
          description: 'Background job and queue monitoring',
          status: 'planned',
        },
      ],
    },

    {
      id: 'PLATFORM_AUDIT',
      label: 'Audit & Compliance',
      items: [
        {
          label: 'Audit Log',
          description: 'System-wide audit trail',
          status: 'planned',
        },
        {
          label: 'Data Changes',
          description: 'Track important HR data changes',
          status: 'planned',
        },
        {
          label: 'Access Log',
          description: 'User access and data access history',
          status: 'planned',
        },
      ],
    },

    {
      id: 'PLATFORM_OPERATIONS',
      label: 'Operations',
      items: [
        {
          label: 'System Logs',
          description: 'Application and integration logs',
          status: 'planned',
        },
        {
          label: 'Queue Monitor',
          description: 'Background queue monitoring',
          status: 'planned',
        },
        {
          label: 'Integration Monitor',
          description: 'External integration health and errors',
          status: 'planned',
        },
        {
          label: 'Feature Flags',
          description: 'Feature rollout and configuration',
          status: 'planned',
        },
      ],
    },
  ],
};

/**
 * Every module, in the order `MODULE_IDS` declares them.
 *
 * Derived, so a module added to the shared contract cannot be left out of the rail.
 */
export const MODULE_MENUS: readonly ModuleMenu[] = MODULE_IDS.map((module) => {
  const groups = MODULE_GROUPS[module];

  return {
    module,
    label: MODULE_META[module].label,
    description: MODULE_META[module].description,
    icon: MODULE_META[module].icon,
    groups,
    hasSurface: groups.some((group) => group.items.some((item) => item.status === 'built')),
  };
});

export const moduleMenu = (module: ModuleId): ModuleMenu | undefined =>
  MODULE_MENUS.find((entry) => entry.module === module);

/**
 * An item that is both built and routable.
 *
 * Requiring `href` here is what lets `ROUTES` be derived without a cast. A cast at the
 * point of use would compile just as happily and then 404 at runtime, which is the exact
 * failure this union exists to prevent.
 */
export type BuiltMenuItem = MenuItem & { readonly href: string; readonly status: 'built' };

/** Every `built` item across all modules, flattened. The only items that may be links. */
export const BUILT_ITEMS: readonly {
  readonly module: ModuleId;
  readonly group: MenuGroup;
  readonly item: BuiltMenuItem;
}[] = MODULE_MENUS.flatMap((entry) =>
  entry.groups.flatMap((group) =>
    // `flatMap` rather than `filter().map()`, because `filter` alone does not carry the
    // narrowing through to the value that survives it.
    group.items.flatMap((item) =>
      item.status === 'built' && item.href !== undefined
        ? [{ module: entry.module, group, item: item as BuiltMenuItem }]
        : [],
    ),
  ),
);

/** The hrefs that exist. Anything not in this set would 404. */
export const ROUTES: readonly string[] = BUILT_ITEMS.map((entry) => entry.item.href);

/**
 * Where a path sits in the tree.
 *
 * Used to derive the active module for the rail and the active item for the sidebar. A
 * deeper path resolves to the route that contains it, so `/employees/42` marks the
 * employee directory as current.
 */
export function locatePath(pathname: string): {
  readonly module: ModuleId;
  readonly group: MenuGroup;
  readonly item: MenuItem;
} | null {
  const match = BUILT_ITEMS.find(
    ({ item }) => item.href !== undefined && isActiveRoute(pathname, item.href),
  );

  return match ?? null;
}

/** The module that owns the current path, or null when the path is outside every module. */
export function activeModule(pathname: string): ModuleId | null {
  return locatePath(pathname)?.module ?? null;
}

/**
 * Whether a navigation entry should render as the current page.
 *
 * `/` must match exactly, or it would stay active on every route. Longer paths match on a
 * segment boundary, so `/employees` does not light up for `/employees-archive`.
 */
export function isActiveRoute(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Label for a path segment, from the route registry where one exists. */
function knownLabel(href: string): string | undefined {
  return BUILT_ITEMS.find(({ item }) => item.href === href)?.item.label;
}

/**
 * Breadcrumb trail for a pathname.
 *
 * The module is prepended only for a path deeper than its own route, because on a
 * top-level route "Employees" alone is unambiguous while "Core HR / Employees" is noise.
 * A deep link with no navigation entry still shows each of its segments, so the reader
 * can see where they are rather than landing on an apparently root-level page.
 *
 * Ancestors link only when their path is a route that exists; an unknown segment is
 * rendered as text, because linking to it would produce a 404 that looks like navigation.
 */
export function breadcrumbTrail(pathname: string): readonly { label: string; href?: string }[] {
  // Trimmed before splitting: a path with surrounding whitespace yields segments that are
  // not blank, so without this a stray space becomes a visible, meaningless crumb.
  const segments = pathname
    .trim()
    .split('/')
    .filter((segment) => segment.length > 0);

  // The normalised form of the path, used for "is this the page being viewed?" below.
  // Comparing a normalised href against the raw `pathname` gets that answer wrong for any
  // path with stray slashes or padding: `'//employees//'` is the employees page, but the
  // string is not equal to `'/employees'`, so the last crumb would render as a link to the
  // page it is already on.
  const normalized = segments.length === 0 ? '/' : `/${segments.join('/')}`;

  if (segments.length === 0) {
    const root = BUILT_ITEMS.find(({ item }) => item.href === '/');
    // No href: the reader is already on the root, so linking it would go nowhere.
    return root === undefined ? [] : [{ label: root.item.label }];
  }

  const located = locatePath(pathname);
  const trail: { label: string; href?: string }[] = [];

  // Prepended for deep paths only. The module itself has no page, so it never links.
  if (segments.length > 1 && located !== null) {
    trail.push({ label: moduleLabel(located.module) });
  }

  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    const label = knownLabel(href) ?? humanise(segment);

    // Only a route that exists may be linked, and never the page being viewed.
    const linkable = href !== normalized && ROUTES.includes(href);

    trail.push(linkable ? { label, href } : { label });
  });

  return trail;
}

const humanise = (segment: string): string =>
  segment
    .split('-')
    .map((word) => (word.length === 0 ? word : `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`))
    .join(' ');
