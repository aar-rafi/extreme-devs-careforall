// User types
export interface User {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  is_active: boolean;
  email_verified: boolean;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

// Campaign types
export type CampaignType = 'medical' | 'education' | 'emergency' | 'long_term';
export type CampaignStatus = 'draft' | 'active' | 'completed' | 'cancelled' | 'expired';

export interface Campaign {
  id: string;
  title: string;
  description: string;
  campaign_type: CampaignType;
  goal_amount: number;
  current_amount: number;
  start_date: string;
  end_date?: string;
  status: CampaignStatus;
  organizer_id: string;
  beneficiary_name?: string;
  beneficiary_details?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignTotals {
  campaign_id: string;
  title: string;
  campaign_type: CampaignType;
  goal_amount: number;
  raised_amount: number;
  donor_count: number;
  last_donation_at?: string;
  status: CampaignStatus;
  progress_percentage: number;
}

export interface CreateCampaignData {
  title: string;
  description: string;
  campaign_type: CampaignType;
  goal_amount: number;
  end_date?: string;
  beneficiary_name?: string;
  beneficiary_details?: string;
  image_url?: string;
}

// Pledge types
export type PledgeStatus = 'pending' | 'payment_initiated' | 'completed' | 'failed' | 'refunded';

export interface Pledge {
  id: string;
  campaign_id: string;
  user_id?: string;
  donor_email: string;
  donor_name?: string;
  amount: number;
  currency: string;
  status: PledgeStatus;
  is_anonymous: boolean;
  message?: string;
  created_at: string;
}

export interface CreatePledgeData {
  campaign_id: string;
  amount: number;
  donor_email: string;
  donor_name?: string;
  is_anonymous?: boolean;
  message?: string;
}

// Payment types
export interface Payment {
  id: string;
  pledge_id: string;
  transaction_id?: string;
  payment_method?: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}
