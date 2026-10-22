import apiClient from './client';
import { Farm, PaginatedResponse } from '../types';

export interface FarmFilters {
  page?: number;
  per_page?: number | 'all';
  search?: string;
  status?: 'active' | 'inactive' | 'all';
}

export const farmsApi = {
  async getAll(filters?: FarmFilters): Promise<Farm[]> {
    // Default to 'all' for standard lookups unless client specifies pagination params
    const params = { per_page: 'all', ...filters };
    const response = await apiClient.get<{ data: Farm[] }>('/farms', { params });
    return response.data.data;
  },

  async getPaginated(filters?: FarmFilters): Promise<PaginatedResponse<Farm>> {
    const response = await apiClient.get<PaginatedResponse<Farm>>('/farms', { params: filters });
    return response.data;
  },

  async getById(id: string | number): Promise<Farm> {
    const response = await apiClient.get<{ data: Farm }>(`/farms/${id}`);
    return response.data.data;
  },

  async create(farm: Farm): Promise<Farm> {
    const response = await apiClient.post<{ data: Farm }>('/farms', farm);
    return response.data.data;
  },

  async update(id: string | number, farm: Farm): Promise<Farm> {
    const response = await apiClient.put<{ data: Farm }>(`/farms/${id}`, farm);
    return response.data.data;
  },

  async delete(id: string | number): Promise<void> {
    await apiClient.delete(`/farms/${id}`);
  },
};
