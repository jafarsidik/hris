/**
 * Demo workforce seed: a company population to browse and open profiles against.
 *
 * The HR modules read through the running API, and an empty database answers every
 * screen with an empty state. This seed provisions one company's structure — an
 * entity, the division/department tree, positions, a workforce of users+employees —
 * plus per-employee record rows (contacts, family, education, experience, skills,
 * certifications, documents) and employment history (contracts, movements), so the
 * directory, the image list and the profile pages have real database rows behind
 * them the first time they open.
 *
 * Idempotent like the other seeds: every write is guarded on its natural key
 * (company code, unit code, position code, user email, employee number), and record
 * rows exist-check before they insert. Running it twice converges, never duplicates.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnvFile } from 'dotenv';
import { join } from 'node:path';

import { buildPostgresUrl, readPostgresSettings } from '../src/connection-string';
import { PrismaClient } from '../src/generated/prisma/client';

import type { PrismaClient as SeedClient } from '../src/generated/prisma/client';

const DEMO_COMPANY_CODE = 'DEMO';
const DEMO_DOMAIN = 'demo.hris.local';

interface DepartmentSpec {
  readonly code: string;
  readonly name: string;
  readonly positions: readonly string[];
}

const DEPARTMENTS: readonly DepartmentSpec[] = [
  { code: 'DEP-HR', name: 'Human Resources', positions: ['HR Manager', 'HR Officer'] },
  { code: 'DEP-FIN', name: 'Finance', positions: ['Finance Manager', 'Accountant'] },
  {
    code: 'DEP-IT',
    name: 'Information Technology',
    positions: ['IT Manager', 'Software Engineer', 'DevOps Engineer', 'QA Engineer'],
  },
  {
    code: 'DEP-OPS',
    name: 'Operations',
    positions: ['Operations Manager', 'Operations Coordinator', 'Logistics Officer'],
  },
  { code: 'DEP-SLS', name: 'Sales', positions: ['Sales Manager', 'Account Executive'] },
  {
    code: 'DEP-MKT',
    name: 'Marketing',
    positions: ['Marketing Manager', 'Brand Designer', 'Content Writer'],
  },
];

const FIRST_NAMES = [
  'Aditya',
  'Benyamin',
  'Citra',
  'Dewi',
  'Eko',
  'Farah',
  'Gilang',
  'Hana',
  'Indra',
  'Joko',
  'Kartika',
  'Lestari',
  'Maya',
  'Nanda',
  'Oscar',
  'Putri',
  'Rizki',
  'Sari',
  'Taufik',
  'Umar',
  'Vina',
  'Wahyu',
  'Xenia',
  'Yoga',
  'Zahra',
  'Bagus',
  'Candra',
  'Dian',
  'Erlangga',
  'Fitri',
  'Galih',
  'Hesti',
  'Ilham',
  'Jessica',
  'Kevin',
  'Laras',
] as const;

const LAST_NAMES = [
  'Santoso',
  'Wibowo',
  'Kusuma',
  'Halim',
  'Pratama',
  'Rahmawati',
  'Nugroho',
  'Anggraini',
  'Wijaya',
  'Saputra',
  'Mahendra',
  'Permana',
  'Utami',
  'Fauzi',
  'Gunawan',
] as const;

const STATUS_PATTERN = [
  'ACTIVE',
  'ACTIVE',
  'ACTIVE',
  'ACTIVE',
  'ON_LEAVE',
  'ACTIVE',
  'ACTIVE',
  'INACTIVE',
  'ACTIVE',
  'ACTIVE',
] as const;

const TYPE_PATTERN = [
  'PERMANENT',
  'PERMANENT',
  'PERMANENT',
  'CONTRACT',
  'PERMANENT',
  'FIXED_TERM',
  'PERMANENT',
  'PERMANENT',
  'INTERN',
  'PART_TIME',
  'PERMANENT',
  'PERMANENT',
] as const;

function iso(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function hireDateFor(index: number): Date {
  const year = 2019 + (index % 7);
  const month = 1 + ((index * 5) % 12);
  const day = 1 + ((index * 3) % 27);
  return iso(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
}

const flatten = <T>(rows: readonly (readonly T[])[]): T[] => rows.flat();

interface UnitPlacement {
  readonly unitId: string;
  readonly unitName: string;
  readonly positionId: string;
  readonly positionName: string;
}

function positionTitleFor(index: number): string {
  const capacity = flatten(DEPARTMENTS.map((department) => department.positions));
  return capacity[index % capacity.length] as string;
}

function fullNameFor(index: number): string {
  const first = FIRST_NAMES[index % FIRST_NAMES.length] as string;
  const last = LAST_NAMES[index % LAST_NAMES.length] as string;
  return `${first} ${last}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function seedDemoWorkforce(client: SeedClient): Promise<{
  readonly company: string;
  readonly units: number;
  readonly positions: number;
  readonly employees: number;
  readonly records: number;
}> {
  // `DEMO_WORKFORCE_COMPANY=<code>` aims the whole seeding at one tenant, which is
  // how a running environment points the demo at the company its operators actually
  // use; without it the oldest non-deleted company wins, creating one if none exists.
  const preferredCode = process.env['DEMO_WORKFORCE_COMPANY'];
  let company = preferredCode
    ? await client.company.findFirst({
        where: { code: preferredCode, deletedAt: null },
        select: { id: true, code: true },
      })
    : null;
  let createdCompany = false;
  if (company === null && preferredCode) {
    company = await client.company.create({
      data: { code: preferredCode, name: `${preferredCode} Company` },
      select: { id: true, code: true },
    });
    createdCompany = true;
  } else if (company === null) {
    company = await client.company.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, code: true },
    });
  }
  if (company === null) {
    company = await client.company.create({
      data: { code: DEMO_COMPANY_CODE, name: 'Demo Company' },
      select: { id: true, code: true },
    });
    createdCompany = true;
  }
  if (company === null) {
    company = await client.company.create({
      data: { code: DEMO_COMPANY_CODE, name: 'Demo Company' },
      select: { id: true, code: true },
    });
    createdCompany = true;
  }

  const entity = await client.entity.upsert({
    where: { companyId_code: { companyId: company.id, code: 'HQ' } },
    update: {},
    create: {
      companyId: company.id,
      code: 'HQ',
      name: 'Head Office — Jakarta',
      countryCode: 'ID',
      currencyCode: 'IDR',
    },
    select: { id: true },
  });

  const root = await client.organizationalUnit.upsert({
    where: { companyId_code: { companyId: company.id, code: 'DIV-HQ' } },
    update: {},
    create: {
      companyId: company.id,
      code: 'DIV-HQ',
      name: 'Head Office',
      type: 'DIVISION',
      entityId: entity.id,
    },
    select: { id: true },
  });

  const units = new Map<string, string>();
  for (const department of DEPARTMENTS) {
    const unit = await client.organizationalUnit.upsert({
      where: { companyId_code: { companyId: company.id, code: department.code } },
      update: {},
      create: {
        companyId: company.id,
        code: department.code,
        name: department.name,
        type: 'DEPARTMENT',
        parentId: root.id,
        entityId: entity.id,
      },
      select: { id: true, name: true },
    });
    units.set(department.name, unit.id);
  }

  const positionIds = new Map<string, { id: string; name: string; unitId: string }>();
  for (const department of DEPARTMENTS) {
    for (const title of department.positions) {
      const position = await client.position.upsert({
        where: {
          companyId_code: { companyId: company.id, code: `POS-${slug(title).toUpperCase()}` },
        },
        update: {},
        create: {
          companyId: company.id,
          code: `POS-${slug(title).toUpperCase()}`,
          name: title,
          organizationalUnit: units.get(department.name) as string,
          jobGrade: title.endsWith('Manager') ? 'G6' : 'G5',
        },
        select: { id: true, name: true },
      });
      positionIds.set(title, {
        id: position.id,
        name: position.name,
        unitId: units.get(department.name) as string,
      });
    }
  }

  const placements: Record<string, UnitPlacement> = {};
  for (let index = 0; index < 36; index += 1) {
    const title = positionTitleFor(index);
    const position = positionIds.get(title) as { id: string; name: string; unitId: string };
    const departmentName =
      DEPARTMENTS.find((department) => department.positions.includes(title))?.name ?? '';
    placements[String(index)] = {
      unitId: position.unitId,
      unitName: departmentName,
      positionId: position.id,
      positionName: position.name,
    };
  }

  const employeeIds: string[] = [];
  const faceDetailIds: string[] = [];

  for (let index = 0; index < 36; index += 1) {
    // Emails embed the company code: the email column is unique across the whole
    // database, so two companies seeded with the same workforce must not share one.
    const email = `demo.${company.code.toLowerCase()}-${String(index + 1).padStart(2, '0')}@${DEMO_DOMAIN}`;
    const displayName = fullNameFor(index);
    const placement = placements[String(index)];

    const existingUser = await client.user.findFirst({
      where: { companyId: company.id, email },
      select: { id: true },
    });
    const user =
      existingUser ??
      (await client.user.create({
        data: {
          companyId: company.id,
          email,
          displayName,
          status: 'ACTIVE',
          organizationalUnitId: placement.unitId,
        },
        select: { id: true },
      }));

    const employeeNumber = `EMP-${String(index + 1).padStart(4, '0')}`;
    const status = STATUS_PATTERN[index % STATUS_PATTERN.length] as string;
    const employmentType = TYPE_PATTERN[index % TYPE_PATTERN.length] as string;

    const existingEmployee = await client.employee.findFirst({
      where: { companyId: company.id, userId: user.id },
      select: { id: true },
    });
    const employee =
      existingEmployee ??
      (await client.employee.create({
        data: {
          companyId: company.id,
          userId: user.id,
          employeeNumber,
          organizationalUnit: placement.unitId,
          position: placement.positionId,
          employmentType,
          status,
          hireDate: hireDateFor(index),
        },
        select: { id: true },
      }));
    employeeIds.push(employee.id);
    if (faceDetailIds.length < 8) {
      faceDetailIds.push(employee.id);
    }

    // One open-ended contract whose start meets the hire date.
    const contractNumber = `PKT-${employeeNumber.replaceAll('EMP-', '')}`;
    await ensureRows({
      table: 'contract',
      exists: await client.employmentContract.findFirst({
        where: { companyId: company.id, employeeId: employee.id, contractNumber },
        select: { id: true },
      }),
      create: () =>
        client.employmentContract.create({
          data: {
            companyId: company.id,
            employeeId: employee.id,
            contractNumber,
            contractType: employmentType === 'PERMANENT' ? 'PERMANENT' : 'FIXED_TERM',
            startDate: hireDateFor(index),
            endDate: employmentType === 'PERMANENT' ? null : iso('2027-12-31'),
            status: 'ACTIVE',
            signedDate: hireDateFor(index),
            notes: employmentType === 'PERMANENT' ? 'Open-ended agreement' : 'Fixed-term agreement',
          },
        }),
    });

    // A movement row for later hires placed from another unit reads like history.
    if (index % 7 === 3) {
      const targetTitle = positionTitleFor(index + 5);
      const target = positionIds.get(targetTitle);
      if (target !== undefined) {
        await ensureRows({
          table: 'movement',
          exists: await client.employeeMovement.findFirst({
            where: { companyId: company.id, employeeId: employee.id, movementType: 'TRANSFER' },
            select: { id: true },
          }),
          create: () =>
            client.employeeMovement.create({
              data: {
                companyId: company.id,
                employeeId: employee.id,
                movementType: 'TRANSFER',
                effectiveDate: iso('2025-01-01'),
                fromUnitName: placement.unitName,
                toUnitName: target.name,
                fromPositionName: placement.positionName,
                toPositionName: target.name,
                reason: 'Organisational restructure',
              },
            }),
        });
      }
    }

    if (!faceDetailIds.includes(employee.id)) {
      continue;
    }

    await ensureRows({
      table: 'contact',
      exists: await client.employeeContact.findFirst({
        where: { companyId: company.id, employeeId: employee.id, name: 'Spouse contact' },
        select: { id: true },
      }),
      create: () =>
        client.employeeContact.createMany({
          data: [
            {
              companyId: company.id,
              employeeId: employee.id,
              name: 'Spouse contact',
              relationship: 'SPOUSE',
              phone: '+62-812-0000-0001',
              email: null,
              address: 'Jakarta Selatan',
              isPrimary: true,
            },
            {
              companyId: company.id,
              employeeId: employee.id,
              name: 'Sibling contact',
              relationship: 'SIBLING',
              phone: '+62-812-0000-0002',
              email: null,
              address: null,
              isPrimary: false,
            },
          ],
        }),
    });

    await ensureRows({
      table: 'family',
      exists: await client.employeeFamilyMember.findFirst({
        where: { companyId: company.id, employeeId: employee.id, fullName: 'Ratna Kusuma' },
        select: { id: true },
      }),
      create: () =>
        client.employeeFamilyMember.createMany({
          data: [
            {
              companyId: company.id,
              employeeId: employee.id,
              fullName: 'Ratna Kusuma',
              relationship: 'SPOUSE',
              birthDate: iso('1992-04-10'),
              occupation: 'Lecturer',
              isDependent: false,
            },
            {
              companyId: company.id,
              employeeId: employee.id,
              fullName: 'Bagas Kusuma',
              relationship: 'CHILD',
              birthDate: iso('2018-09-01'),
              occupation: null,
              isDependent: true,
            },
          ],
        }),
    });

    await ensureRows({
      table: 'education',
      exists: await client.employeeEducation.findFirst({
        where: { companyId: company.id, employeeId: employee.id, level: 'S1' },
        select: { id: true },
      }),
      create: () =>
        client.employeeEducation.createMany({
          data: [
            {
              companyId: company.id,
              employeeId: employee.id,
              level: 'S1',
              institution: 'Universitas Indonesia',
              major: 'Management',
              startYear: 2011,
              endYear: 2015,
            },
            {
              companyId: company.id,
              employeeId: employee.id,
              level: 'SMA',
              institution: 'SMA 3 Jakarta',
              major: 'IPA',
              startYear: 2008,
              endYear: 2011,
            },
          ],
        }),
    });

    await ensureRows({
      table: 'experience',
      exists: await client.employeeExperience.findFirst({
        where: { companyId: company.id, employeeId: employee.id, companyName: 'PT Maju Bersama' },
        select: { id: true },
      }),
      create: () =>
        client.employeeExperience.createMany({
          data: [
            {
              companyId: company.id,
              employeeId: employee.id,
              companyName: 'PT Maju Bersama',
              positionTitle: 'Analyst',
              startDate: iso('2016-02-01'),
              endDate: iso('2019-01-31'),
              description: null,
            },
          ],
        }),
    });

    await ensureRows({
      table: 'skill',
      exists: await client.employeeSkill.findFirst({
        where: { companyId: company.id, employeeId: employee.id, name: 'Communication' },
        select: { id: true },
      }),
      create: () =>
        client.employeeSkill.createMany({
          data: [
            {
              companyId: company.id,
              employeeId: employee.id,
              name: 'Communication',
              proficiency: 'ADVANCED',
              yearsOfExperience: 5,
            },
            {
              companyId: company.id,
              employeeId: employee.id,
              name: 'Project Delivery',
              proficiency: 'INTERMEDIATE',
              yearsOfExperience: 3,
            },
          ],
        }),
    });

    await ensureRows({
      table: 'certification',
      exists: await client.employeeCertification.findFirst({
        where: { companyId: company.id, employeeId: employee.id, name: 'HR Certification' },
        select: { id: true },
      }),
      create: () =>
        client.employeeCertification.createMany({
          data: [
            {
              companyId: company.id,
              employeeId: employee.id,
              name: 'HR Certification',
              issuer: 'SHRM',
              issueDate: iso('2022-06-01'),
              expiryDate: iso('2026-06-01'),
              credentialId: null,
            },
          ],
        }),
    });

    await ensureRows({
      table: 'document',
      exists: await client.employeeDocument.findFirst({
        where: { companyId: company.id, employeeId: employee.id, title: 'Employment contract' },
        select: { id: true },
      }),
      create: () =>
        client.employeeDocument.createMany({
          data: [
            {
              companyId: company.id,
              employeeId: employee.id,
              title: 'Employment contract',
              category: 'CONTRACT',
              fileUrl: null,
              expiryDate: null,
              note: 'Signed copy on file',
            },
            {
              companyId: company.id,
              employeeId: employee.id,
              title: 'KTP',
              category: 'IDENTITY',
              fileUrl: null,
              expiryDate: null,
              note: null,
            },
          ],
        }),
    });
  }

  return {
    company: createdCompany ? `${company.code} (created)` : company.code,
    units: units.size,
    positions: positionIds.size,
    employees: employeeIds.length,
    records: faceDetailIds.length,
  };
}

/** Small helper so each guarded record write reads the same way. */
async function ensureRows(input: {
  readonly table: string;
  readonly exists: { readonly id: string } | null;
  readonly create: () => Promise<unknown>;
}): Promise<void> {
  if (input.exists !== null) {
    return;
  }
  await input.create();
}

/** Direct script entry: `npm run db:seed -w @hris/database` (registered in `seed.ts`). */
async function runStandalone(): Promise<void> {
  loadEnvFile({ path: join(__dirname, '..', '..', '.env'), quiet: true });

  const client = new PrismaClient({
    adapter: new PrismaPg(buildPostgresUrl(readPostgresSettings(process.env))),
    log: ['warn', 'error'],
  });
  try {
    const summary = await seedDemoWorkforce(client);
    console.log(
      `Demo workforce: company ${summary.company}, ${summary.employees} employees, ` +
        `${summary.records} with rich record histories.`,
    );
  } finally {
    await client.$disconnect();
  }
}

const invokedDirectly = process.argv[1]?.endsWith('demo-workforce.ts') ?? false;
if (invokedDirectly) {
  runStandalone().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
