import { apiClient } from './client';
import { ApiResponse, PaginatedResponse } from '@/types';

export interface Donation {
  id: string;
  campaign_id: string;
  donor_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  is_anonymous: boolean;
  message?: string;
  donor?: {
    first_name?: string;
    last_name?: string;
    email: string;
  };
  created_at: string;
}

export interface CreateDonationData {
  campaign_id: string;
  amount: number;
  currency?: string;
  payment_method: string;
  is_anonymous?: boolean;
  message?: string;
}

export const donationsApi = {
  list: async (params?: {
    campaign_id?: string;
    donor_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Donation>> => {
    const response = await apiClient.get<PaginatedResponse<Donation>>('/api/donations', { params });
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<Donation>> => {
    const response = await apiClient.get<ApiResponse<Donation>>(`/api/donations/${id}`);
    return response.data;
  },

  create: async (data: CreateDonationData): Promise<ApiResponse<Donation>> => {
    const response = await apiClient.post<ApiResponse<Donation>>('/api/donations', data);
    return response.data;
  },

  initializePayment: async (donationId: string): Promise<ApiResponse<{ payment_url: string }>> => {
    const response = await apiClient.post<ApiResponse<{ payment_url: string }>>(
      `/api/donations/${donationId}/payment`
    );
    return response.data;
  },
};
