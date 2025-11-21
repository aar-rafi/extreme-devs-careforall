const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient = null;

/**
 * Get or create Redis client
 * @returns {Promise<RedisClient>} Redis client instance
 */
async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error', { error: err });
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    await redisClient.connect();
  }

  return redisClient;
}

/**
 * Cache helper functions
 */
const cache = {
  /**
   * Get value from cache
   * @param {string} key Cache key
   * @returns {Promise<any>} Cached value (parsed JSON if applicable)
   */
  async get(key) {
    const client = await getRedisClient();
    const value = await client.get(key);
    try {
      return value ? JSON.parse(value) : null;
    } catch {
      return value;
    }
  },

  /**
   * Set value in cache
   * @param {string} key Cache key
   * @param {any} value Value to cache
   * @param {number} ttl Time to live in seconds (optional)
   */
  async set(key, value, ttl) {
    const client = await getRedisClient();
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    if (ttl) {
      await client.setEx(key, ttl, stringValue);
    } else {
      await client.set(key, stringValue);
    }
  },

  /**
   * Delete key from cache
   * @param {string} key Cache key
   */
  async del(key) {
    const client = await getRedisClient();
    await client.del(key);
  },

  /**
   * Delete multiple keys matching pattern
   * @param {string} pattern Key pattern (e.g., "campaign:*")
   */
  async delPattern(pattern) {
    const client = await getRedisClient();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  },
};

/**
 * Close Redis connection
 */
async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

module.exports = {
  getRedisClient,
  cache,
  closeRedis,
};
