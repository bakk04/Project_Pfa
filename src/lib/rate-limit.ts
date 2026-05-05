import { redis } from './redis';

/**
 * Basic Redis-based rate limiter
 * @param key unique key for the rate limit (e.g. user ID or IP)
 * @param limit maximum number of requests
 * @param window window in seconds
 * @returns { success: boolean, remaining: number }
 */
export async function rateLimit(key: string, limit: number, window: number) {
  if (!redis || redis.status !== 'ready') {
    // If Redis is not available, fail open or closed? 
    // For a real SaaS, maybe fail open but log.
    return { success: true, remaining: limit };
  }

  try {
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, window);
    }

    const remaining = Math.max(0, limit - current);
    
    return {
      success: current <= limit,
      remaining
    };
  } catch (error) {
    console.error('[RateLimit] Error:', error);
    return { success: true, remaining: limit };
  }
}
