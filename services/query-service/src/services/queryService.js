const { getPool } = require('@careforall/shared/database/pool');
const { logger } = require('@careforall/shared');

class QueryService {
  async getCampaignStats(campaignId) {
    const pool = getPool();
    const query = `
      SELECT * FROM query.campaign_totals
      WHERE campaign_id = $1
    `;
    const result = await pool.query(query, [campaignId]);
    return result.rows[0] || null;
  }

  async getTrendingCampaigns(limit = 10) {
    const pool = getPool();
    const query = `
      SELECT ct.*
      FROM query.campaign_totals ct
      WHERE ct.last_donation_at >= NOW() - INTERVAL '7 days'
      ORDER BY ct.raised_amount DESC, ct.donor_count DESC
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  async getUserStats(userId) {
    const pool = getPool();
    const query = `
      SELECT * FROM query.user_statistics
      WHERE user_id = $1
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0] || {
      user_id: userId,
      total_donated: 0,
      campaigns_supported: 0,
      donation_count: 0,
    };
  }

  async getPlatformStats() {
    const pool = getPool();
    const query = `
      SELECT * FROM query.platform_statistics
      WHERE id = 1
    `;
    const result = await pool.query(query);
    return result.rows[0] || {
      total_raised: 0,
      total_donations: 0,
      total_campaigns: 0,
      active_campaigns: 0,
      total_users: 0,
    };
  }

  async getRecentDonations(limit = 20) {
    const pool = getPool();
    const query = `
      SELECT dh.*
      FROM query.donation_history dh
      WHERE dh.status = 'completed'
      ORDER BY dh.completed_at DESC
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  async getUserDonationHistory(userId) {
    const pool = getPool();
    const query = `
      SELECT * FROM query.donation_history
      WHERE donor_id = $1
      ORDER BY donated_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  async getCampaignDonations(campaignId) {
    const pool = getPool();
    const query = `
      SELECT
        amount,
        donated_at,
        CASE WHEN is_anonymous THEN null ELSE donor_id END as donor_id,
        CASE WHEN is_anonymous THEN null ELSE donor_name END as donor_name,
        is_anonymous,
        message
      FROM query.donation_history
      WHERE campaign_id = $1
      ORDER BY donated_at DESC
    `;
    const result = await pool.query(query, [campaignId]);
    return result.rows;
  }

  async getTopDonors(limit = 10) {
    const pool = getPool();
    const query = `
      SELECT
        user_id,
        total_donated,
        donation_count,
        campaigns_supported
      FROM query.user_statistics
      WHERE user_id IS NOT NULL
      ORDER BY total_donated DESC
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  }
}

module.exports = new QueryService();
