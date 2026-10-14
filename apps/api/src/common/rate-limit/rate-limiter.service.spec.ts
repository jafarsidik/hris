import { RateLimiter } from './rate-limiter.service';
import type { RedisService } from '../../modules/redis/redis.service';

/** Minimal in-memory stand-in for the subset of Redis the limiter uses. */
function createFakeRedis(): {
  service: RedisService;
  values: Map<string, number>;
  expiries: Map<string, number>;
} {
  const values = new Map<string, number>();
  const expiries = new Map<string, number>();
  const client = {
    incr: async (key: string): Promise<number> => {
      const next = (values.get(key) ?? 0) + 1;
      values.set(key, next);
      return next;
    },
    expire: async (key: string, seconds: number): Promise<number> => {
      expiries.set(key, seconds);
      return 1;
    },
    ttl: async (key: string): Promise<number> => expiries.get(key) ?? -1,
  };
  return {
    service: { getClient: () => client } as unknown as RedisService,
    values,
    expiries,
  };
}

describe('RateLimiter', () => {
  it('allows requests up to the limit and reports the remaining budget', async () => {
    const { service } = createFakeRedis();
    const limiter = new RateLimiter(service);

    const first = await limiter.consume('k', 3, 60);
    expect(first).toMatchObject({ allowed: true, limit: 3, remaining: 2, retryAfterSeconds: 0 });

    const second = await limiter.consume('k', 3, 60);
    expect(second).toMatchObject({ allowed: true, remaining: 1 });

    const third = await limiter.consume('k', 3, 60);
    expect(third).toMatchObject({ allowed: true, remaining: 0 });
  });

  it('blocks once the window is spent and tells the caller when to retry', async () => {
    const { service } = createFakeRedis();
    const limiter = new RateLimiter(service);

    await limiter.consume('k', 2, 45);
    await limiter.consume('k', 2, 45);

    const blocked = await limiter.consume('k', 2, 45);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(45);
  });

  it('restores an expiry when a key outlived its TTL without one', async () => {
    const { service, expiries } = createFakeRedis();
    const limiter = new RateLimiter(service);

    await limiter.consume('k', 30, 30);
    // Simulate a key that persisted after its TTL would have elapsed.
    expiries.delete('k');

    const result = await limiter.consume('k', 30, 30);
    expect(result.allowed).toBe(true);
    expect(expiries.get('k')).toBe(30);
  });
});
