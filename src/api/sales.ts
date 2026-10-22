import apiClient from './client';
import { Sale, CreateSalePayload, PaginatedResponse } from '../types';

export interface SalesFilterParams {
  search?: string;
  farm_id?: string | number;
  crop_cycle_id?: string | number;
  crop_id?: string | number;
  buyer_id?: string | number;
  date?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number | 'all';
}

export const salesApi = {
  async getSales(params?: SalesFilterParams): Promise<Sale[]> {
    const response = await apiClient.get<{ data: Sale[] }>('/sales', {
      params: { per_page: 'all', ...params },
    });
    return response.data.data;
  },

  async getSalesPaginated(params?: SalesFilterParams): Promise<PaginatedResponse<Sale>> {
    const response = await apiClient.get<PaginatedResponse<Sale>>('/sales', { params });
    return response.data;
  },

  async getById(id: string | number): Promise<Sale> {
    const response = await apiClient.get<{ data: Sale }>(`/sales/${id}`);
    return response.data.data;
  },

  async createSale(payload: CreateSalePayload): Promise<Sale> {
    const response = await apiClient.post<{ data: Sale }>('/sales', payload);
    return response.data.data;
  },

  async updateSale(id: string | number, payload: Partial<CreateSalePayload>): Promise<Sale> {
    const response = await apiClient.put<{ data: Sale }>(`/sales/${id}`, payload);
    return response.data.data;
  },

  async deleteSale(id: string | number): Promise<void> {
    await apiClient.delete(`/sales/${id}`);
  },
};
