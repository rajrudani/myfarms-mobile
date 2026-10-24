import apiClient from './client';
import { FarmActivity, PaginatedResponse } from '../types';

export interface FarmActivityFilters {
  farm_id?: string | number;
  crop_cycle_id?: string | number;
  status?: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number | 'all';
  search?: string;
}

export const farmActivitiesApi = {
  async getAll(params?: FarmActivityFilters): Promise<FarmActivity[]> {
    const response = await apiClient.get<{ data: FarmActivity[] }>('/farm-activities', {
      params: { per_page: 'all', ...params },
    });
    return response.data.data;
  },

  async getPaginated(params?: FarmActivityFilters): Promise<PaginatedResponse<FarmActivity>> {
    const response = await apiClient.get<PaginatedResponse<FarmActivity>>('/farm-activities', { params });
    return response.data;
  },

  async getById(id: string | number): Promise<FarmActivity> {
    const response = await apiClient.get<{ data: FarmActivity }>(`/farm-activities/${id}`);
    return response.data.data;
  },

  async create(activity: Partial<FarmActivity> & { farm_id: string | number; farm_activity_master_id: string | number; date: string }): Promise<FarmActivity> {
    const response = await apiClient.post<{ data: FarmActivity }>('/farm-activities', activity);
    return response.data.data;
  },

  async update(id: string | number, activity: Partial<FarmActivity>): Promise<FarmActivity> {
    const response = await apiClient.put<{ data: FarmActivity }>(`/farm-activities/${id}`, activity);
    return response.data.data;
  },

  async delete(id: string | number): Promise<void> {
    await apiClient.delete(`/farm-activities/${id}`);
  },
};
