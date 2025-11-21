import { apiClient } from './client';
import {
  Campaign,
  CreateCampaignData,
  CampaignTotals,
  ApiResponse,
  PaginatedResponse,
} from '@/types';

export const campaignsApi = {
  list: async (params?: {
    status?: string;
    campaignType?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Campaign>> => {
    const response = await apiClient.get<PaginatedResponse<Campaign>>('/api/campaigns', {
      params,
    });
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<Campaign>> => {
    const response = await apiClient.get<ApiResponse<Campaign>>(`/api/campaigns/${id}`);
    return response.data;
  },

  getTotals: async (id: string): Promise<ApiResponse<CampaignTotals>> => {
    const response = await apiClient.get<ApiResponse<CampaignTotals>>(
      `/api/query/campaigns/${id}/totals`
    );
    return response.data;
  },

  create: async (data: CreateCampaignData): Promise<ApiResponse<Campaign>> => {
    const response = await apiClient.post<ApiResponse<Campaign>>('/api/campaigns', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateCampaignData>): Promise<ApiResponse<Campaign>> => {
    const response = await apiClient.put<ApiResponse<Campaign>>(`/api/campaigns/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/campaigns/${id}`);
    return response.data;
  },
};
