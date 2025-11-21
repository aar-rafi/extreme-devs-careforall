const crypto = require('crypto');
const { getPool } = require('@careforall/shared/database/pool');
const { logger } = require('@careforall/shared');
const { AppError } = require('@careforall/shared/middleware/errorHandler');

/**
 * Idempotency middleware
 * Prevents duplicate payment initiations by checking idempotency keys
 */
async function idempotencyMiddleware(req, res, next) {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];

    if (!idempotencyKey) {
      throw new AppError(
        'Idempotency key is required in headers (X-Idempotency-Key)',
        400,
        'IDEMPOTENCY_KEY_REQUIRED'
      );
    }

    // Create hash of request body for additional verification
    const requestHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');

    const pool = getPool();

    // Check if this idempotency key was already processed
    const checkQuery = `
      SELECT * FROM payments.idempotency_keys
      WHERE idempotency_key = $1
        AND expires_at > NOW()
    `;

    const result = await pool.query(checkQuery, [idempotencyKey]);

    if (result.rows.length > 0) {
      const existingRecord = result.rows[0];

      // Verify request body matches (prevent key reuse with different data)
      if (existingRecord.request_hash !== requestHash) {
        throw new AppError(
          'Idempotency key already used with different request data',
          409,
          'IDEMPOTENCY_KEY_CONFLICT'
        );
      }

      // Return cached response
      logger.info('Returning cached response for idempotency key', { idempotencyKey });
      return res.status(existingRecord.status_code).json(existingRecord.response);
    }

    // Store idempotency key and request info for later
    req.idempotencyKey = idempotencyKey;
    req.requestHash = requestHash;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Store idempotency response
 * Call this after successfully processing a request
 */
async function storeIdempotencyResponse(idempotencyKey, requestHash, response, statusCode) {
  const pool = getPool();

  try {
    // Store for 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const query = `
      INSERT INTO payments.idempotency_keys (
        idempotency_key, request_hash, response, status_code, expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (idempotency_key) DO NOTHING
    `;

    await pool.query(query, [idempotencyKey, requestHash, response, statusCode, expiresAt]);

    logger.info('Stored idempotency response', { idempotencyKey });
  } catch (error) {
    logger.error('Failed to store idempotency response', {
      error: error.message,
      idempotencyKey,
    });
    // Don't throw - this is not critical
  }
}

module.exports = {
  idempotencyMiddleware,
  storeIdempotencyResponse,
};
