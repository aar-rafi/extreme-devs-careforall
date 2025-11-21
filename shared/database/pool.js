const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool = null;

/**
 * Get or create PostgreSQL connection pool
 * @returns {Pool} PostgreSQL pool instance
 */
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle PostgreSQL client', { error: err });
    });

    pool.on('connect', () => {
      logger.info('New PostgreSQL client connected');
    });

    logger.info('PostgreSQL connection pool created');
  }

  return pool;
}

/**
 * Execute a query with automatic client acquisition/release
 * @param {string} text SQL query
 * @param {Array} params Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
  const start = Date.now();
  const res = await getPool().query(text, params);
  const duration = Date.now() - start;

  logger.debug('Executed query', { text, duration, rows: res.rowCount });
  return res;
}

/**
 * Get a client from the pool (for transactions)
 * @returns {Promise<PoolClient>} PostgreSQL client
 */
async function getClient() {
  const client = await getPool().connect();
  return client;
}

/**
 * Close the connection pool
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('PostgreSQL connection pool closed');
  }
}

module.exports = {
  getPool,
  query,
  getClient,
  closePool,
};
