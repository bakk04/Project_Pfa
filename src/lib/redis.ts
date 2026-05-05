import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_USER = process.env.REDIS_USER || 'default';

// Force TLS to be false unless specifically requested.
// Redis Cloud on high ports (like 14172) almost NEVER uses TLS.
const USE_TLS = process.env.REDIS_TLS === 'true';

const getRedisClient = () => {
  try {
    let client: Redis;

    const commonOptions: any = {
      lazyConnect: true,
      tls: USE_TLS ? {} : undefined,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 500, 2000);
      },
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
    };

    // Auto-disable TLS if we detect a common non-TLS Redis Cloud port
    if (REDIS_PORT && parseInt(REDIS_PORT) > 10000 && !process.env.REDIS_TLS) {
        commonOptions.tls = undefined;
    }

    if (REDIS_URL) {
      client = new Redis(REDIS_URL, commonOptions);
    } else if (REDIS_HOST && REDIS_PORT) {
      client = new Redis({
        host: REDIS_HOST,
        port: parseInt(REDIS_PORT),
        username: REDIS_USER,
        password: REDIS_PASSWORD,
        ...commonOptions,
      });
    } else {
      return null;
    }

    client.on('error', (err: any) => {
      // Catching the SSL error and providing a clear message
      if (err.message.includes('packet length too long') || err.message.includes('WRONG_VERSION_NUMBER')) {
        console.error('[ioredis] TLS ERROR: Your Redis instance is likely NOT using TLS/SSL.');
        console.error('[ioredis] Recommendation: Ensure REDIS_TLS is NOT set to true in your .env file.');
      } else {
        console.error(`[ioredis] Connection Status: ${err.message}`);
      }
    });

    client.on('connect', () => {
      console.log('Redis Connection: SUCCESS');
    });

    client.connect().catch(() => {});

    return client;
  } catch (error) {
    console.error('Redis Initialization Failed:', error);
    return null;
  }
};

export const redis = getRedisClient();

export const cacheSession = async (key: string, data: any, ttl = 86400) => {
  if (!redis || redis.status !== 'ready') return;
  try {
    await redis.set(key, JSON.stringify(data), 'EX', ttl);
  } catch (error) {
  }
};

export const getCachedSession = async (key: string) => {
  if (!redis || redis.status !== 'ready') return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    return null;
  }
};
