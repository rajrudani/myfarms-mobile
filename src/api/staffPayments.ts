import apiClient from './client';
import { StaffPayment, PaginatedResponse } from '../types';

export interface PaymentFilters {
  page?: number;
  per_page?: number | 'all';
  staff_id?: number | string;
  date_from?: string;
  date_to?: string;
  search?: string;
  settlement_status?: 'settled' | 'unsettled' | 'all';
  payment_method?: string;
}

export interface CreatePaymentData {
  farm_staff_id: number;
  amount: number;
  date: string;
  payment_method: 'cash' | 'google_pay' | 'phonepe' | 'other_upi' | 'bank_transfer';
  payment_type?: 'daily_expense' | 'other';
  notes?: string | null;
  given_by_id?: number | null;
}

export const staffPaymentsApi = {
  async getAll(filters?: PaymentFilters): Promise<StaffPayment[]> {
    const params = { per_page: 'all', ...filters };
    const response = await apiClient.get<PaginatedResponse<StaffPayment> | { data: StaffPayment[] }>('/staff-payments', { params });
    return response.data.data;
  },

  async getPaginated(filters?: PaymentFilters): Promise<PaginatedResponse<StaffPayment>> {
    const response = await apiClient.get<PaginatedResponse<StaffPayment>>('/staff-payments', { params: filters });
    return response.data;
  },

  async getById(id: string | number): Promise<StaffPayment> {
    const response = await apiClient.get<{ data: StaffPayment }>(`/staff-payments/${id}`);
    return response.data.data;
  },

  async create(data: CreatePaymentData): Promise<StaffPayment> {
    const response = await apiClient.post<{ data: StaffPayment }>('/staff-payments', data);
    return response.data.data;
  },

  async update(id: string | number, data: Partial<CreatePaymentData>): Promise<StaffPayment> {
    const response = await apiClient.put<{ data: StaffPayment }>(`/staff-payments/${id}`, data);
    return response.data.data;
  },

  async delete(id: string | number): Promise<void> {
    await apiClient.delete(`/staff-payments/${id}`);
  },
};
