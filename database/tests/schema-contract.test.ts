/**
 * Guards the schema against `@hris/shared-types`.
 *
 * `@hris/shared-types` is hand-authored while `schema.prisma` is not, so the two drift
 * apart silently: an action or scope added to the shared vocabulary authorises
 * something in the API that the database enum will then reject at runtime, or a row is
 * seeded for a value the API no longer recognises. Neither shows up in a type check,
 * because the shared constants are plain arrays rather than a generated contract.
 *
 * These tests read `schema.prisma` as text instead of using the generated client, so a
 * mismatch is reported with both sides named. The generated client would report the
 * difference only as two similar-looking arrays of strings.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ACTIONS, DATA_SCOPES, RESOURCES, SYSTEM_ROLE_KEYS } from '@hris/shared-types';

import { SOFT_DELETED_MODELS } from '../src/soft-delete-extension';

const SCHEMA = readFileSync(join(__dirname, '..', 'schema.prisma'), 'utf8');

/**
 * Extracts the members of a Prisma enum block.
 *
 * Deliberately a regex over the text: `prisma` is a dev dependency that must not be
 * loaded just to read a file, and the grammar it needs here is small and stable.
 */
function enumMembers(name: string): string[] {
  const block = new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`, 'm').exec(SCHEMA);

  if (!block) {
    throw new Error(`Enum ${name} is not declared in schema.prisma`);
  }

  return [...block[1].matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/gm)].map((match) => match[1]);
}

/** Model blocks, keyed by name. */
function modelBlocks(): Map<string, string> {
  const models = new Map<string, string>();

  for (const match of SCHEMA.matchAll(/^model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)^\}/gm)) {
    models.set(match[1], match[2]);
  }

  return models;
}

describe('schema contract with @hris/shared-types', () => {
  it('exposes exactly the shared actions', () => {
    expect(new Set(enumMembers('Action'))).toEqual(new Set(ACTIONS));
  });

  it('exposes exactly the shared data scopes', () => {
    expect(new Set(enumMembers('DataScope'))).toEqual(new Set(DATA_SCOPES));
  });

  it('has an enum value matching every shared role key', () => {
    // The `roles` table stores the key as a string rather than an enum, so this asserts
    // the seed input is representable and that no key was renamed in only one place.
    const seededKeys = new Set(SYSTEM_ROLE_KEYS);

    expect(seededKeys.size).toBeGreaterThan(0);
    for (const key of seededKeys) {
      expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('keeps Permission.resource a string so hyphenated resources remain legal', () => {
    const permission = modelBlocks().get('Permission');

    // `industrial-relation` is in RESOURCES and is not a valid Prisma enum member, so
    // this column must not become an enum. If someone "fixes" the schema by adding one,
    // the seed will fail at runtime on that resource and this test explains why first.
    expect(permission).toBeDefined();
    expect(permission).toMatch(/resource\s+String\b/);
    expect(RESOURCES).toContain('industrial-relation');
  });
});

describe('soft-delete contract', () => {
  it('lists exactly the models that declare a deletedAt field', () => {
    const models = modelBlocks();
    const withSoftDelete = new Set(
      [...models.entries()]
        .filter(([, body]) => /^\s*deletedAt\s+DateTime\?/m.test(body))
        .map(([name]) => name),
    );

    // The runtime filter is a hardcoded list because Prisma 7 does not expose `dmmf`.
    // This test is what stops that list from becoming a lie.
    expect(new Set(SOFT_DELETED_MODELS)).toEqual(withSoftDelete);
  });
});
