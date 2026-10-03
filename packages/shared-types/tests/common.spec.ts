import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPaginated,
  isApiErrorResponse,
  isApiSuccessResponse,
  normalisePageParams,
  toOffsetLimit,
  type ApiResponse,
} from '../src';

describe('pagination', () => {
  describe('normalisePageParams', () => {
    it('falls back to defaults for missing input', () => {
      expect(normalisePageParams({})).toEqual({
        page: DEFAULT_PAGE,
        pageSize: DEFAULT_PAGE_SIZE,
      });
    });

    it('accepts numeric strings from query parameters', () => {
      expect(normalisePageParams({ page: '3', pageSize: '50' })).toEqual({
        page: 3,
        pageSize: 50,
      });
    });

    it('clamps pageSize to the maximum', () => {
      expect(normalisePageParams({ pageSize: 10_000 }).pageSize).toBe(MAX_PAGE_SIZE);
    });

    it.each([0, -1, 1.5, Number.NaN, 'abc', null, {}])(
      'rejects the invalid page value %p',
      (page) => {
        expect(normalisePageParams({ page }).page).toBe(DEFAULT_PAGE);
      },
    );

    it.each([0, -5, 2.5, Number.NaN, 'ten', null, {}])(
      'rejects the invalid pageSize value %p',
      (pageSize) => {
        expect(normalisePageParams({ pageSize }).pageSize).toBe(DEFAULT_PAGE_SIZE);
      },
    );
  });

  describe('buildPaginated', () => {
    it('computes total pages and navigation flags', () => {
      const result = buildPaginated(['a', 'b'], { page: 2, pageSize: 2 }, 7);
      expect(result.items).toEqual(['a', 'b']);
      expect(result.meta).toEqual({
        page: 2,
        pageSize: 2,
        totalItems: 7,
        totalPages: 4,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });

    it('reports no navigation on an empty result set', () => {
      const result = buildPaginated([], { page: 1, pageSize: 20 }, 0);
      expect(result.meta.totalPages).toBe(0);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(false);
    });

    it('reports no next page on the last page', () => {
      const result = buildPaginated(['a'], { page: 3, pageSize: 1 }, 3);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(true);
    });
  });

  describe('toOffsetLimit', () => {
    it('converts page numbers to SQL offset/limit', () => {
      expect(toOffsetLimit({ page: 3, pageSize: 25 })).toEqual({ skip: 50, take: 25 });
    });
  });
});

describe('api envelope', () => {
  const success: ApiResponse<{ id: string }> = {
    success: true,
    data: { id: 'abc' },
  };
  const failure: ApiResponse<never> = {
    success: false,
    error: { code: 'FORBIDDEN', message: 'Not allowed' },
  };

  it('narrows success responses', () => {
    expect(isApiSuccessResponse(success)).toBe(true);
    expect(isApiErrorResponse(success)).toBe(false);
    if (isApiSuccessResponse(success)) {
      expect(success.data.id).toBe('abc');
    }
  });

  it('narrows error responses', () => {
    expect(isApiErrorResponse(failure)).toBe(true);
    expect(isApiSuccessResponse(failure)).toBe(false);
  });
});