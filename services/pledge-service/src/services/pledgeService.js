const { getPool } = require('@careforall/shared/database/pool');
const { logger } = require('@careforall/shared');
const { AppError } = require('@careforall/shared/middleware/errorHandler');
const { EVENTS } = require('@careforall/shared');

class PledgeService {
  /**
   * Create a pledge with Transactional Outbox pattern
   * This ensures the pledge and outbox event are created atomically
   */
  async createPledge(pledgeData) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { campaign_id, user_id, amount, message, is_anonymous } = pledgeData;

      // Create the pledge
      const pledgeQuery = `
        INSERT INTO pledges.pledges (campaign_id, user_id, amount, message, is_anonymous, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING *
      `;
      const pledgeResult = await client.query(pledgeQuery, [
        campaign_id,
        user_id,
        amount,
        message,
        is_anonymous || false,
      ]);
      const pledge = pledgeResult.rows[0];

      // Insert event into outbox table (Transactional Outbox pattern)
      const outboxQuery = `
        INSERT INTO pledges.outbox (
          aggregate_id, aggregate_type, event_type, payload
        )
        VALUES ($1, $2, $3, $4)
      `;
      const eventPayload = {
        pledge_id: pledge.id,
        campaign_id: pledge.campaign_id,
        user_id: pledge.user_id,
        amount: pledge.amount,
        status: pledge.status,
      };

      await client.query(outboxQuery, [
        pledge.id,
        'pledge',
        EVENTS.PLEDGE_CREATED,
        JSON.stringify(eventPayload),
      ]);

      await client.query('COMMIT');
      logger.info('Pledge created with outbox event', { pledgeId: pledge.id });
      return pledge;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating pledge', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async getPledgeById(id) {
    const pool = getPool();
    const query = 'SELECT * FROM pledges.pledges WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  async getPledgesByUser(userId) {
    const pool = getPool();
    const query = `
      SELECT * FROM pledges.pledges
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  async getPledgesByCampaign(campaignId) {
    const pool = getPool();
    const query = `
      SELECT
        id, campaign_id, amount, message, created_at, status,
        CASE WHEN is_anonymous THEN null ELSE user_id END as user_id,
        is_anonymous
      FROM pledges.pledges
      WHERE campaign_id = $1
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [campaignId]);
    return result.rows;
  }

  async cancelPledge(id) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const query = `
        UPDATE pledges.pledges
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        throw new AppError('Pledge not found', 404, 'PLEDGE_NOT_FOUND');
      }

      const pledge = result.rows[0];

      // Insert cancellation event into outbox
      const outboxQuery = `
        INSERT INTO pledges.outbox (
          aggregate_id, aggregate_type, event_type, payload
        )
        VALUES ($1, $2, $3, $4)
      `;
      const eventPayload = {
        pledge_id: pledge.id,
        campaign_id: pledge.campaign_id,
        user_id: pledge.user_id,
        amount: pledge.amount,
        previous_status: 'pending',
        new_status: 'cancelled',
      };

      await client.query(outboxQuery, [
        pledge.id,
        'pledge',
        EVENTS.PLEDGE_CANCELLED,
        JSON.stringify(eventPayload),
      ]);

      await client.query('COMMIT');
      logger.info('Pledge cancelled', { pledgeId: id });
      return pledge;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updatePledgeStatus(id, status, payment_reference = null) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const query = `
        UPDATE pledges.pledges
        SET status = $1, payment_reference = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;
      const result = await client.query(query, [status, payment_reference, id]);

      if (result.rows.length === 0) {
        throw new AppError('Pledge not found', 404, 'PLEDGE_NOT_FOUND');
      }

      const pledge = result.rows[0];

      // Insert status change event into outbox
      const outboxQuery = `
        INSERT INTO pledges.outbox (
          aggregate_id, aggregate_type, event_type, payload
        )
        VALUES ($1, $2, $3, $4)
      `;

      const eventType =
        status === 'completed' ? EVENTS.PLEDGE_COMPLETED : EVENTS.PLEDGE_FAILED;

      const eventPayload = {
        pledge_id: pledge.id,
        campaign_id: pledge.campaign_id,
        user_id: pledge.user_id,
        amount: pledge.amount,
        status: pledge.status,
        payment_reference: pledge.payment_reference,
      };

      await client.query(outboxQuery, [
        pledge.id,
        'pledge',
        eventType,
        JSON.stringify(eventPayload),
      ]);

      await client.query('COMMIT');
      logger.info('Pledge status updated', { pledgeId: id, status });
      return pledge;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getCampaignTotalPledges(campaignId) {
    const pool = getPool();
    const query = `
      SELECT
        COUNT(*) as total_pledges,
        COALESCE(SUM(amount), 0) as total_amount
      FROM pledges.pledges
      WHERE campaign_id = $1 AND status IN ('pending', 'completed')
    `;
    const result = await pool.query(query, [campaignId]);
    return result.rows[0];
  }
}

module.exports = new PledgeService();
