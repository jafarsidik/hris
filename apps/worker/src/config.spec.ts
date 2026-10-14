import { loadWorkerConfig } from './config';

describe('loadWorkerConfig', () => {
  it('applies documented defaults when the environment is empty', () => {
    const config = loadWorkerConfig({});
    expect(config.redis).toMatchObject({ host: 'localhost', port: 6381, db: 0 });
    expect(config.smtp.host).toBeNull();
    expect(config.smtp.port).toBe(1025);
    expect(config.mailFrom.address).toBe('no-reply@hris.local');
    expect(config.webBaseUrl).toBe('http://localhost:3000');
    expect(config.concurrency).toBe(5);
  });

  it('prefers environment values and derives the web URL from CORS_ORIGINS', () => {
    const config = loadWorkerConfig({
      REDIS_HOST: 'redis.internal',
      REDIS_PORT: '6380',
      REDIS_PASSWORD: 'secret',
      SMTP_HOST: 'smtp.example.com',
      SMTP_SECURE: 'true',
      CORS_ORIGINS: 'https://app.example.com,https://admin.example.com',
      WORKER_CONCURRENCY: '12',
    });

    expect(config.redis).toMatchObject({ host: 'redis.internal', port: 6380, password: 'secret' });
    expect(config.smtp).toMatchObject({ host: 'smtp.example.com', secure: true });
    expect(config.webBaseUrl).toBe('https://app.example.com');
    expect(config.concurrency).toBe(12);
  });

  it('never returns a concurrency below one', () => {
    expect(loadWorkerConfig({ WORKER_CONCURRENCY: '0' }).concurrency).toBe(1);
    expect(loadWorkerConfig({ WORKER_CONCURRENCY: 'not-a-number' }).concurrency).toBe(5);
  });
});
