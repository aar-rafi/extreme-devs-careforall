import { apiClient } from './client';
import { ApiResponse } from '@/types';

export interface AdminStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalDonations: number;
  totalAmount: number;
  totalUsers: number;
  pendingApprovals: number;
}

export interface AdminCampaign {
  id: string;
  title: string;
  campaign_type: string;
  goal_amount: number;
  current_amount: number;
  status: string;
  organizer_email: string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  first_name?: string;
  last_name?: string;
}

export const adminApi = {
  getStats: async (): Promise<ApiResponse<AdminStats>> => {
    const response = await apiClient.get<ApiResponse<AdminStats>>('/api/admin/dashboard/stats');
    return response.data;
  },

  getCampaigns: async (params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<AdminCampaign[]>> => {
    const response = await apiClient.get<ApiResponse<AdminCampaign[]>>('/api/admin/campaigns', {
      params,
    });
    return response.data;
  },

  updateCampaignStatus: async (
    campaignId: string,
    status: string
  ): Promise<ApiResponse<AdminCampaign>> => {
    const response = await apiClient.patch<ApiResponse<AdminCampaign>>(
      `/api/admin/campaigns/${campaignId}/status`,
      { status }
    );
    return response.data;
  },

  getUsers: async (params?: {
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<AdminUser[]>> => {
    const response = await apiClient.get<ApiResponse<AdminUser[]>>('/api/admin/users', {
      params,
    });
    return response.data;
  },

  updateUserStatus: async (userId: string, is_active: boolean): Promise<ApiResponse<AdminUser>> => {
    const response = await apiClient.patch<ApiResponse<AdminUser>>(
      `/api/admin/users/${userId}/status`,
      { isActive: is_active }
    );
    return response.data;
  },
};
