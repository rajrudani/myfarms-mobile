import apiClient from './client';
import { CropCycle, PaginatedResponse } from '../types';

export interface CropCycleFilters {
  farm_id?: string | number;
  status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'all' | string;
  crop_id?: string | number;
  search?: string;
  page?: number;
  per_page?: number | 'all';
}

export const cropCyclesApi = {
  async getAll(params?: CropCycleFilters): Promise<CropCycle[]> {
    const queryParams = { per_page: 'all', ...params };
    const response = await apiClient.get<{ data: CropCycle[] }>('/crop-cycles', { params: queryParams });
    return response.data.data;
  },

  async getPaginated(params?: CropCycleFilters): Promise<PaginatedResponse<CropCycle>> {
    const response = await apiClient.get<PaginatedResponse<CropCycle>>('/crop-cycles', { params });
    return response.data;
  },

  async getById(id: string | number): Promise<CropCycle> {
    const response = await apiClient.get<{ data: CropCycle }>(`/crop-cycles/${id}`);
    return response.data.data;
  },

  async create(cropCycle: CropCycle): Promise<CropCycle> {
    const response = await apiClient.post<{ data: CropCycle }>('/crop-cycles', cropCycle);
    return response.data.data;
  },

  async update(id: string | number, cropCycle: CropCycle): Promise<CropCycle> {
    const response = await apiClient.put<{ data: CropCycle }>(`/crop-cycles/${id}`, cropCycle);
    return response.data.data;
  },

  async delete(id: string | number): Promise<void> {
    await apiClient.delete(`/crop-cycles/${id}`);
  },
};
