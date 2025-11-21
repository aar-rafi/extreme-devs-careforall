const { getPool } = require('@careforall/shared/database/pool');
const { logger } = require('@careforall/shared');

class DashboardService {
  /**
   * Get platform-wide statistics for admin dashboard
   */
  async getStats() {
    const pool = getPool();

    try {
      //  Aggregate statistics from multiple sources
      const stats = {};

      // Campaign statistics
      const campaignStats = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active') as active_campaigns,
          COUNT(*) FILTER (WHERE status = 'draft') as draft_campaigns,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_campaigns,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_campaigns,
          COUNT(*) as total_campaigns
        FROM campaigns.campaigns
      `);
      stats.campaigns = campaignStats.rows[0];

      // User statistics
      const userStats = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE is_active = true) as active_users,
          COUNT(*) FILTER (WHERE is_active = false) as inactive_users,
          COUNT(*) FILTER (WHERE role = 'ADMIN') as admin_users,
          COUNT(*) as total_users
        FROM auth.users
      `);
      stats.users = userStats.rows[0];

      // Pledge statistics
      const pledgeStats = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') as pending_pledges,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_pledges,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_pledges,
          COUNT(*) as total_pledges,
          COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as total_pledged_amount
        FROM pledges.pledges
      `);
      stats.pledges = pledgeStats.rows[0];

      // Payment statistics
      const paymentStats = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'completed') as completed_payments,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_payments,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_payments,
          COUNT(*) FILTER (WHERE status = 'refunded') as refunded_payments,
          COUNT(*) as total_payments,
          COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as total_payment_amount,
          COALESCE(SUM(amount) FILTER (WHERE status = 'refunded'), 0) as total_refunded_amount
        FROM payments.payments
      `);
      stats.payments = paymentStats.rows[0];

      // Platform statistics from query service
      const platformStats = await pool.query(`
        SELECT * FROM query.platform_statistics WHERE id = 1
      `);
      stats.platform = platformStats.rows[0] || {};

      // Recent activity (last 24 hours)
      const recentActivity = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM campaigns.campaigns WHERE created_at >= NOW() - INTERVAL '24 hours') as campaigns_24h,
          (SELECT COUNT(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '24 hours') as users_24h,
          (SELECT COUNT(*) FROM pledges.pledges WHERE created_at >= NOW() - INTERVAL '24 hours') as pledges_24h,
          (SELECT COALESCE(SUM(amount), 0) FROM pledges.pledges WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '24 hours') as revenue_24h
      `);
      stats.recentActivity = recentActivity.rows[0];

      // Notification statistics
      const notificationStats = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'sent' AND notification_type = 'email') as emails_sent,
          COUNT(*) FILTER (WHERE status = 'sent' AND notification_type = 'push') as push_sent,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_notifications
        FROM notifications.notification_history
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `);
      stats.notifications = notificationStats.rows[0];

      logger.info('Dashboard statistics retrieved');
      return stats;
    } catch (error) {
      logger.error('Failed to get dashboard statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Get trending campaigns (highest activity)
   */
  async getTrendingCampaigns(limit = 10) {
    const pool = getPool();

    try {
      const result = await pool.query(`
        SELECT
          c.id,
          c.title,
          c.campaign_type,
          c.goal_amount,
          ct.raised_amount,
          ct.donor_count,
          ct.progress_percentage,
          c.status,
          c.created_at
        FROM campaigns.campaigns c
        LEFT JOIN query.campaign_totals ct ON c.id = ct.campaign_id
        WHERE c.status = 'active'
        ORDER BY ct.raised_amount DESC, ct.donor_count DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get trending campaigns', { error: error.message });
      throw error;
    }
  }

  /**
   * Get recent admin actions
   */
  async getRecentAdminActions(limit = 20) {
    const pool = getPool();

    try {
      const result = await pool.query(`
        SELECT
          al.*,
          u.email as admin_email,
          up.first_name,
          up.last_name
        FROM admin.audit_logs al
        JOIN auth.users u ON al.admin_id = u.id
        LEFT JOIN auth.user_profiles up ON u.id = up.user_id
        ORDER BY al.created_at DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get recent admin actions', { error: error.message });
      throw error;
    }
  }
}

module.exports = new DashboardService();
