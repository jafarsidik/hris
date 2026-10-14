/**
 * Organizational-hierarchy lookups for data scopes.
 *
 * A `TEAM` or `DEPARTMENT` grant narrows a query to the subtree rooted at an
 * organizational unit; an `ENTITY` grant narrows it to that unit's legal entity. Both
 * need a recursive walk, and both run inside the tenant transaction so the row-level
 * security policies on `organizational_units` still apply.
 *
 * The recursion carries a depth guard. The hierarchy is maintained as a tree, but a
 * corrupted `parent_id` cycle would otherwise make these queries spin forever, and a
 * hang inside a request transaction is a far worse failure than a truncated subtree.
 */

import type { Prisma } from './generated/prisma/client';

const MAX_DEPTH = 32;

/** Every unit id in the subtree rooted at `rootUnitId`, including the root itself. */
export async function findOrgUnitSubtree(
  tx: Prisma.TransactionClient,
  rootUnitId: string,
): Promise<string[]> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE subtree AS (
      SELECT id, 0 AS depth
        FROM organizational_units
        WHERE id = ${rootUnitId}::uuid AND deleted_at IS NULL
      UNION ALL
      SELECT u.id, s.depth + 1
        FROM organizational_units u
        JOIN subtree s ON u.parent_id = s.id
        WHERE u.deleted_at IS NULL AND s.depth < ${MAX_DEPTH}
    )
    SELECT id FROM subtree
  `;

  return rows.map((row) => row.id);
}

/**
 * The legal entity the unit belongs to, walking up to the nearest ancestor that has
 * one. Returns null when the unit is unknown or no ancestor is assigned an entity.
 */
export async function findOrgUnitEntity(
  tx: Prisma.TransactionClient,
  rootUnitId: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<{ entity_id: string | null }[]>`
    WITH RECURSIVE lineage AS (
      SELECT id, parent_id, entity_id, 0 AS depth
        FROM organizational_units
        WHERE id = ${rootUnitId}::uuid AND deleted_at IS NULL
      UNION ALL
      SELECT u.id, u.parent_id, u.entity_id, l.depth + 1
        FROM organizational_units u
        JOIN lineage l ON u.id = l.parent_id
        WHERE u.deleted_at IS NULL AND l.depth < ${MAX_DEPTH}
    )
    SELECT entity_id FROM lineage WHERE entity_id IS NOT NULL ORDER BY depth LIMIT 1
  `;

  return rows[0]?.entity_id ?? null;
}

/** Every unit that belongs to the given legal entity. */
export async function findOrgUnitIdsByEntity(
  tx: Prisma.TransactionClient,
  entityId: string,
): Promise<string[]> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM organizational_units
      WHERE entity_id = ${entityId}::uuid AND deleted_at IS NULL
  `;

  return rows.map((row) => row.id);
}
