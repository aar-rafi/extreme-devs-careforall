import { apiClient } from './client';
import { Pledge, CreatePledgeData, ApiResponse } from '@/types';

export const pledgesApi = {
  create: async (data: CreatePledgeData): Promise<ApiResponse<Pledge>> => {
    const response = await apiClient.post<ApiResponse<Pledge>>('/api/pledges', data);
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<Pledge>> => {
    const response = await apiClient.get<ApiResponse<Pledge>>(`/api/pledges/${id}`);
    return response.data;
  },

  getUserPledges: async (userId: string): Promise<ApiResponse<Pledge[]>> => {
    const response = await apiClient.get<ApiResponse<Pledge[]>>(`/api/pledges/user/${userId}`);
    return response.data;
  },
};
