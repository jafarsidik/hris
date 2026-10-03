import {
  DEFAULT_HTTP_PORT,
  NODE_ENVIRONMENTS,
  WILDCARD_HOST,
  isProduction,
  parseConfiguration,
  toNestLogLevel,
} from './app-configuration';
import { ConfigurationError } from './configuration.error';

describe('parseConfiguration', () => {
  describe('defaults', () => {
    it('produces a usable configuration from an empty environment', () => {
      const config = parseConfiguration({});

      expect(config.environment).toBe('development');
      expect(config.http.port).toBe(DEFAULT_HTTP_PORT);
      expect(config.http.host).toBe(WILDCARD_HOST);
      expect(config.http.globalPrefix).toBe('api');
      expect(config.http.corsOrigins).toEqual(['http://localhost:3000']);
      expect(config.swagger.enabled).toBe(true);
    });

    it('excludes health probes from the versioned, prefixed API surface', () => {
      const config = parseConfiguration({});
      expect(config.http.healthExclusions).toEqual(['health', 'health/live', 'health/ready']);
    });

    it('defaults to an explicit allow-list of browser origins', () => {
      // A wildcard origin would defeat credentialed requests entirely.
      expect(parseConfiguration({}).http.corsOrigins).not.toContain('*');
    });
  });

  describe('parsing', () => {
    it('reads an explicit configuration', () => {
      const config = parseConfiguration({
        NODE_ENV: 'staging',
        API_HOST: '127.0.0.1',
        API_PORT: '4000',
        CORS_ORIGINS: 'https://hris.example.com, https://admin.example.com',
        LOG_LEVEL: 'warn',
      });

      expect(config.environment).toBe('staging');
      expect(config.http.host).toBe('127.0.0.1');
      expect(config.http.port).toBe(4000);
      expect(config.http.corsOrigins).toEqual([
        'https://hris.example.com',
        'https://admin.example.com',
      ]);
      expect(config.logging.level).toBe('warn');
    });

    it('rejects localhost as a bind host because it resolves to the IPv6 loopback', () => {
      // Regression guard: "localhost" made the API listen on ::1 only, so IPv4
      // clients and container health checks got ECONNREFUSED while startup logs
      // still reported success.
      expect(() => parseConfiguration({ API_HOST: 'localhost' })).toThrow(ConfigurationError);
      expect(() => parseConfiguration({ API_HOST: 'localhost' })).toThrow(/::1/);
    });

    it.each([['0.0.0.0'], ['127.0.0.1'], ['::']])('accepts the explicit bind host %p', (host) => {
      expect(parseConfiguration({ API_HOST: host }).http.host).toBe(host);
    });

    it('treats blank values as absent so an empty variable cannot mask a default', () => {
      expect(parseConfiguration({ API_PORT: '   ' }).http.port).toBe(DEFAULT_HTTP_PORT);
    });
  });

  describe('validation', () => {
    it('rejects an unknown NODE_ENV', () => {
      expect(() => parseConfiguration({ NODE_ENV: 'prod' })).toThrow(ConfigurationError);
    });

    it.each(['abc', '80.5', '-1', '70000'])('rejects the invalid API_PORT %j', (API_PORT) => {
      expect(() => parseConfiguration({ API_PORT })).toThrow(ConfigurationError);
    });

    it('rejects an unknown LOG_LEVEL', () => {
      expect(() => parseConfiguration({ LOG_LEVEL: 'trace' })).toThrow(ConfigurationError);
    });

    it('reports every problem at once instead of only the first', () => {
      let caught: unknown;
      try {
        parseConfiguration({ NODE_ENV: 'prod', API_PORT: 'abc', LOG_LEVEL: 'trace' });
      } catch (error: unknown) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ConfigurationError);
      const problems = (caught as ConfigurationError).problems;
      expect(problems).toHaveLength(3);
      expect(problems.join('\n')).toContain('NODE_ENV');
      expect(problems.join('\n')).toContain('API_PORT');
      expect(problems.join('\n')).toContain('LOG_LEVEL');
    });
  });

  describe('production hardening', () => {
    it('disables OpenAPI in production by default', () => {
      const config = parseConfiguration({ NODE_ENV: 'production' });
      expect(config.swagger.enabled).toBe(false);
      expect(isProduction(config)).toBe(true);
    });

    it('allows OpenAPI to be explicitly re-enabled in production', () => {
      expect(
        parseConfiguration({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }).swagger.enabled,
      ).toBe(true);
    });

    it('reduces the log level in production', () => {
      expect(parseConfiguration({ NODE_ENV: 'production' }).logging.level).toBe('log');
    });

    it('does not trust forwarding headers unless the deployment opts in', () => {
      expect(parseConfiguration({ NODE_ENV: 'production' }).http.trustProxyHops).toBe(0);
      expect(parseConfiguration({ TRUST_PROXY_HOPS: '2' }).http.trustProxyHops).toBe(2);
    });
  });
});

describe('toNestLogLevel', () => {
  it('expands a level into the cumulative list NestJS expects', () => {
    expect(toNestLogLevel('error')).toEqual(['error']);
    expect(toNestLogLevel('warn')).toEqual(['error', 'warn']);
    expect(toNestLogLevel('log')).toEqual(['error', 'warn', 'log']);
    expect(toNestLogLevel('verbose')).toEqual(['error', 'warn', 'log', 'debug', 'verbose']);
  });
});

describe('NODE_ENVIRONMENTS', () => {
  it('only allows explicitly supported environments', () => {
    expect([...NODE_ENVIRONMENTS]).toEqual(['development', 'test', 'staging', 'production']);
  });
});
