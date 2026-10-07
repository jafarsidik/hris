/**
 * Cursor-based pagination contracts shared by every list endpoint.
 *
 * Offset pagination is not offered and has no replacement. Skipping and repeating
 * rows when data is inserted between requests makes a payroll export silently
 * wrong, which is the worst way for a list endpoint to fail: the caller gets a
 * well-formed response that is quietly missing employees.
 *
 * The wire shape is fixed by API.md:
 *
 * ```json
 * { "success": true, "data": { "items": [], "pageInfo": { "hasNextPage": false, "endCursor": null } } }
 * ```
 *
 * A cursor is opaque to clients. It is round-tripped unchanged and never parsed by
 * the browser or the mobile client, so this module is the only place that defines
 * its encoding.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Bounded query input for one page request. */
export interface PageParams {
  readonly limit: number;
  /** Opaque cursor from a previous response. Absent for the first page. */
  readonly cursor?: string;
}

/** What a client needs in order to ask for the next page, and nothing more. */
export interface PageInfo {
  readonly hasNextPage: boolean;
  readonly endCursor: string | null;
}

export interface Paginated<TItem> {
  readonly items: readonly TItem[];
  readonly pageInfo: PageInfo;
}

/**
 * The ordering values that identify one row within a sorted sequence.
 *
 * A single value is not enough: sorting by `created_at` alone is ambiguous when two
 * rows share a timestamp, and an ambiguous cursor either drops or repeats a row. The
 * final entry is therefore always the row's unique id, which makes the ordering a
 * total order.
 */
export interface CursorPosition {
  readonly values: readonly string[];
}

/** A decoded cursor. */
export interface Cursor {
  readonly position: CursorPosition;
  /**
   * Identifies the filters and sort the sequence was opened with, so continuing a
   * sequence under different filters is detected rather than silently returning a
   * corrupt page.
   */
  readonly fingerprint: string;
}

/**
 * Rejects a cursor that does not belong to the sequence being continued.
 *
 * Returned as a result rather than thrown so that the calling endpoint decides how
 * to report it. A cursor from a different filter set is a client mistake and should
 * surface as `VALIDATION_ERROR`, not as an empty page.
 */
export type CursorResolution =
  { readonly ok: true; readonly cursor: Cursor } | { readonly ok: false };

const toPositiveInteger = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
};

/**
 * Normalises untrusted pagination input into a bounded {@link PageParams}.
 *
 * This is the single place where `cursor`/`limit` query values are trusted; every
 * list endpoint must call it rather than reading the raw query object.
 */
export function normalisePageParams(input: { cursor?: unknown; limit?: unknown }): PageParams {
  const limit = Math.min(toPositiveInteger(input.limit, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const cursor =
    typeof input.cursor === 'string' && input.cursor.length > 0 ? input.cursor : undefined;
  return cursor === undefined ? { limit } : { limit, cursor };
}

/**
 * How many rows a query must fetch to answer a page request.
 *
 * One row more than the caller asked for, because `hasNextPage` is then decided by
 * whether a surplus row exists. That avoids a `COUNT(*)` over the whole filtered set
 * on every page, which on an employee directory is the single most expensive thing
 * the endpoint could do.
 */
export function toFetchLimit(params: PageParams): number {
  return params.limit + 1;
}

/**
 * Turns a fetched window into the response body.
 *
 * `rows` may contain up to {@link toFetchLimit} entries; the surplus row proves
 * another page exists and is discarded here so it is never returned twice.
 *
 * `positionOf` must return the ordering values of the row the next page starts
 * after, which for a keyset query is the last row of the page just returned.
 */
export function buildPage<TItem>(
  rows: readonly TItem[],
  params: PageParams,
  fingerprint: string,
  positionOf: (row: TItem) => CursorPosition,
): Paginated<TItem> {
  const hasSurplus = rows.length > params.limit;
  const items = hasSurplus ? rows.slice(0, params.limit) : rows;

  if (items.length === 0) {
    return { items, pageInfo: { hasNextPage: false, endCursor: null } };
  }

  // A page that exactly fills the limit may or may not be the last one; without the
  // surplus row the honest answer is "maybe", which is reported as no further page.
  // Under-reporting costs one extra empty request, whereas over-reporting would send
  // a client after a cursor that leads nowhere.
  const lastItem = items[items.length - 1];
  if (lastItem === undefined) {
    return { items, pageInfo: { hasNextPage: false, endCursor: null } };
  }

  return {
    items,
    pageInfo: {
      hasNextPage: hasSurplus,
      endCursor: hasSurplus ? encodeCursor(positionOf(lastItem), fingerprint) : null,
    },
  };
}

/**
 * Canonicalises a value so that two structurally equal filters produce the same
 * fingerprint regardless of key order.
 */
function canonicalise(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalise(entry)).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalise(entryValue)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * FNV-1a over the canonical filter and sort description.
 *
 * This is deliberately not a cryptographic hash. It guards against a client
 * continuing a sequence under different filters, which is an accident rather than
 * an attack; an attacker who can craft a cursor can equally craft one with a valid
 * fingerprint, because the endpoint re-checks the position against its own query.
 * The encoding is not a security boundary and must not be relied on as one.
 */
export function cursorFingerprint(spec: { filters: unknown; sort: unknown }): string {
  const input = `${canonicalise(spec.filters)}|${canonicalise(spec.sort)}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Base64url without `btoa`, `atob` or `Buffer`.
 *
 * This module is imported by the browser and the mobile client as well as the API,
 * so it cannot depend on a host-provided encoder that only one of them has.
 * `charAt` is used rather than indexing because the shared tsconfig sets
 * `noUncheckedIndexedAccess`.
 */
function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const triple = (first << 16) | (second << 8) | third;
    output += BASE64URL_ALPHABET.charAt((triple >> 18) & 63);
    output += BASE64URL_ALPHABET.charAt((triple >> 12) & 63);
    output += index + 1 < bytes.length ? BASE64URL_ALPHABET.charAt((triple >> 6) & 63) : '';
    output += index + 2 < bytes.length ? BASE64URL_ALPHABET.charAt(triple & 63) : '';
  }
  return output;
}

function decodeBase64Url(input: string): string | null {
  if (input.length === 0) {
    return null;
  }
  const values: number[] = [];
  for (const character of input) {
    const value = BASE64URL_ALPHABET.indexOf(character);
    if (value === -1) {
      return null;
    }
    values.push(value);
  }

  const bytes = new Uint8Array(Math.floor((values.length * 6) / 8));
  let buffer = 0;
  let bitCount = 0;
  let cursor = 0;
  for (const value of values) {
    buffer = (buffer << 6) | value;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes[cursor] = (buffer >> bitCount) & 0xff;
      cursor += 1;
    }
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Encodes a position into the opaque token handed to clients. */
export function encodeCursor(position: CursorPosition, fingerprint: string): string {
  return encodeBase64Url(JSON.stringify({ p: position.values, f: fingerprint }));
}

/**
 * Decodes a token received from a client.
 *
 * Returns `null` for anything that is not a cursor this module produced: wrong
 * charset, corrupt base64, invalid UTF-8, or a payload that is not the expected
 * shape. Callers must treat `null` as a bad request rather than as "no cursor",
 * because silently restarting at the first page would re-send rows the client
 * already has.
 */
export function decodeCursor(encoded: string): Cursor | null {
  const json = decodeBase64Url(encoded);
  if (json === null) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const candidate = payload as { p?: unknown; f?: unknown };
  if (!Array.isArray(candidate.p) || typeof candidate.f !== 'string') {
    return null;
  }
  if (!candidate.p.every((value) => typeof value === 'string')) {
    return null;
  }

  return { position: { values: candidate.p }, fingerprint: candidate.f };
}

/**
 * Validates a client-supplied cursor against the sequence being continued.
 *
 * @param encoded the raw cursor from the query, if any.
 * @param fingerprint {@link cursorFingerprint} for this request's filters and sort.
 */
export function resolveCursor(encoded: string | undefined, fingerprint: string): CursorResolution {
  if (encoded === undefined) {
    // No cursor means the caller wants the first page, which is always valid.
    return { ok: true, cursor: { position: { values: [] }, fingerprint } };
  }
  const decoded = decodeCursor(encoded);
  if (decoded === null || decoded.fingerprint !== fingerprint) {
    return { ok: false };
  }
  return { ok: true, cursor: decoded };
}
