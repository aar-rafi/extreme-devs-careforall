import { apiClient } from './client';
import { ApiResponse } from '@/types';

export interface PaymentInitiateData {
  pledge_id: string;
  success_url?: string;
  fail_url?: string;
  cancel_url?: string;
}

export interface PaymentResponse {
  payment_id: string;
  transaction_id: string;
  gateway_url: string;
  amount: string;
  currency: string;
  status: string;
}

export interface PaymentStatus {
  id: string;
  pledge_id: string;
  transaction_id: string;
  payment_method?: string;
  amount: string;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  gateway_response?: any;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export const paymentsApi = {
  /**
   * Initiate payment for a pledge
   * Requires X-Idempotency-Key header to prevent duplicate payments
   */
  initiate: async (
    data: PaymentInitiateData,
    idempotencyKey: string
  ): Promise<ApiResponse<PaymentResponse>> => {
    const response = await apiClient.post<ApiResponse<PaymentResponse>>(
      '/api/payments/initiate',
      data,
      {
        headers: {
          'X-Idempotency-Key': idempotencyKey,
        },
      }
    );
    return response.data;
  },

  /**
   * Get payment status by payment ID
   */
  getById: async (paymentId: string): Promise<ApiResponse<PaymentStatus>> => {
    const response = await apiClient.get<ApiResponse<PaymentStatus>>(
      `/api/payments/${paymentId}`
    );
    return response.data;
  },

  /**
   * Get payment by pledge ID
   */
  getByPledgeId: async (pledgeId: string): Promise<ApiResponse<PaymentStatus>> => {
    const response = await apiClient.get<ApiResponse<PaymentStatus>>(
      `/api/payments/pledge/${pledgeId}`
    );
    return response.data;
  },
};
