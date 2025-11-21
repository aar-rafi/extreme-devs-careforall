const { getPool } = require('@careforall/shared/database/pool');
const { logger } = require('@careforall/shared');
const auditService = require('./auditService');

class CampaignAdminService {
  /**
   * List all campaigns with filtering and pagination
   * @param {Object} filters - Filter options
   * @param {string} filters.status - Filter by status
   * @param {string} filters.campaignType - Filter by campaign type
   * @param {string} filters.search - Search by title or description
   * @param {number} filters.limit - Page size
   * @param {number} filters.offset - Offset for pagination
   */
  async listCampaigns(filters = {}) {
    const pool = getPool();
    const { status, campaignType, search, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT
        c.*,
        u.email as organizer_email,
        up.first_name as organizer_first_name,
        up.last_name as organizer_last_name,
        ct.raised_amount,
        ct.donor_count,
        ct.progress_percentage
      FROM campaigns.campaigns c
      JOIN auth.users u ON c.organizer_id = u.id
      LEFT JOIN auth.user_profiles up ON u.id = up.user_id
      LEFT JOIN query.campaign_totals ct ON c.id = ct.campaign_id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND c.status = $${paramIndex++}`;
      params.push(status);
    }

    if (campaignType) {
      query += ` AND c.campaign_type = $${paramIndex++}`;
      params.push(campaignType);
    }

    if (search) {
      query += ` AND (c.title ILIKE $${paramIndex++} OR c.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`, `%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    try {
      const result = await pool.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM campaigns.campaigns c WHERE 1=1`;
      const countParams = [];
      let countParamIndex = 1;

      if (status) {
        countQuery += ` AND c.status = $${countParamIndex++}`;
        countParams.push(status);
      }

      if (campaignType) {
        countQuery += ` AND c.campaign_type = $${countParamIndex++}`;
        countParams.push(campaignType);
      }

      if (search) {
        countQuery += ` AND (c.title ILIKE $${countParamIndex++} OR c.description ILIKE $${countParamIndex})`;
        countParams.push(`%${search}%`, `%${search}%`);
        countParamIndex++;
      }

      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        campaigns: result.rows,
        total,
        limit,
        offset,
      };
    } catch (error) {
      logger.error('Failed to list campaigns', { error: error.message, filters });
      throw error;
    }
  }

  /**
   * Approve a campaign (change status from draft to active)
   * @param {string} campaignId - Campaign ID
   * @param {string} adminId - Admin user ID
   * @param {string} ipAddress - Admin IP address
   * @param {string} userAgent - Admin user agent
   */
  async approveCampaign(campaignId, adminId, ipAddress, userAgent) {
    const pool = getPool();

    try {
      // Get current campaign status
      const campaign = await pool.query(
        'SELECT * FROM campaigns.campaigns WHERE id = $1',
        [campaignId]
      );

      if (campaign.rows.length === 0) {
        throw new Error('Campaign not found');
      }

      const currentStatus = campaign.rows[0].status;

      // Only draft campaigns can be approved
      if (currentStatus !== 'draft') {
        throw new Error(`Campaign is already ${currentStatus}, cannot approve`);
      }

      // Update campaign status to active
      await pool.query(
        `UPDATE campaigns.campaigns
         SET status = 'active', updated_at = NOW()
         WHERE id = $1`,
        [campaignId]
      );

      // Log the action
      await auditService.logAction(
        adminId,
        'approve_campaign',
        'campaign',
        campaignId,
        { previousStatus: currentStatus, newStatus: 'active' },
        ipAddress,
        userAgent
      );

      logger.info('Campaign approved', { campaignId, adminId });

      return { success: true, message: 'Campaign approved successfully' };
    } catch (error) {
      logger.error('Failed to approve campaign', {
        error: error.message,
        campaignId,
        adminId,
      });
      throw error;
    }
  }

  /**
   * Reject a campaign
   * @param {string} campaignId - Campaign ID
   * @param {string} adminId - Admin user ID
   * @param {string} reason - Rejection reason
   * @param {string} ipAddress - Admin IP address
   * @param {string} userAgent - Admin user agent
   */
  async rejectCampaign(campaignId, adminId, reason, ipAddress, userAgent) {
    const pool = getPool();

    try {
      // Get current campaign
      const campaign = await pool.query(
        'SELECT * FROM campaigns.campaigns WHERE id = $1',
        [campaignId]
      );

      if (campaign.rows.length === 0) {
        throw new Error('Campaign not found');
      }

      const currentStatus = campaign.rows[0].status;

      // Update campaign status to cancelled
      await pool.query(
        `UPDATE campaigns.campaigns
         SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1`,
        [campaignId]
      );

      // Log the action
      await auditService.logAction(
        adminId,
        'reject_campaign',
        'campaign',
        campaignId,
        { previousStatus: currentStatus, newStatus: 'cancelled', reason },
        ipAddress,
        userAgent
      );

      logger.info('Campaign rejected', { campaignId, adminId, reason });

      return { success: true, message: 'Campaign rejected successfully' };
    } catch (error) {
      logger.error('Failed to reject campaign', {
        error: error.message,
        campaignId,
        adminId,
      });
      throw error;
    }
  }

  /**
   * Get campaign details
   * @param {string} campaignId - Campaign ID
   */
  async getCampaignDetails(campaignId) {
    const pool = getPool();

    try {
      const result = await pool.query(`
        SELECT
          c.*,
          u.email as organizer_email,
          up.first_name as organizer_first_name,
          up.last_name as organizer_last_name,
          ct.raised_amount,
          ct.donor_count,
          ct.progress_percentage,
          ct.last_donation_at
        FROM campaigns.campaigns c
        JOIN auth.users u ON c.organizer_id = u.id
        LEFT JOIN auth.user_profiles up ON u.id = up.user_id
        LEFT JOIN query.campaign_totals ct ON c.id = ct.campaign_id
        WHERE c.id = $1
      `, [campaignId]);

      if (result.rows.length === 0) {
        throw new Error('Campaign not found');
      }

      // Get donation history for this campaign
      const donations = await pool.query(`
        SELECT * FROM query.donation_history
        WHERE campaign_id = $1
        ORDER BY donated_at DESC
        LIMIT 20
      `, [campaignId]);

      return {
        campaign: result.rows[0],
        recentDonations: donations.rows,
      };
    } catch (error) {
      logger.error('Failed to get campaign details', {
        error: error.message,
        campaignId,
      });
      throw error;
    }
  }
}

module.exports = new CampaignAdminService();
