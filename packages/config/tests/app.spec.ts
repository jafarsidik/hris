import { API_VERSIONS, DEFAULT_API_VERSION, HEALTH_PATHS, buildApiPath } from '../src';

describe('api path builder', () => {
  it('builds a versioned path', () => {
    expect(buildApiPath('/employees')).toBe('/api/v1/employees');
  });

  it('normalises a path without a leading slash', () => {
    expect(buildApiPath('employees')).toBe('/api/v1/employees');
  });

  it('supports explicitly requesting another version', () => {
    expect(buildApiPath('/employees', '1')).toBe('/api/v1/employees');
  });

  it('exposes a default version that is actually supported', () => {
    expect(API_VERSIONS).toContain(DEFAULT_API_VERSION);
  });

  it('keeps health paths unversioned', () => {
    expect(HEALTH_PATHS.root).toBe('/health');
    expect(HEALTH_PATHS.live).toBe('/health/live');
    expect(HEALTH_PATHS.ready).toBe('/health/ready');
  });
});
