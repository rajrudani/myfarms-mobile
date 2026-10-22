import apiClient from './client';
import { ConsultantVisit, CreateConsultantVisitPayload, UpdateConsultantVisitPayload, PaginatedResponse } from '../types';

export interface ConsultantVisitFilters {
  search?: string;
  consultant_id?: string | number;
  farm_id?: string | number;
  status?: string;
  page?: number;
  per_page?: number | string;
}

export const consultantVisitsApi = {
  async getAll(params?: ConsultantVisitFilters): Promise<ConsultantVisit[]> {
    const response = await apiClient.get<PaginatedResponse<ConsultantVisit> | { data: ConsultantVisit[] }>('/consultant-visits', {
      params: { per_page: 'all', ...params },
    });
    return Array.isArray(response.data) ? response.data : response.data.data;
  },

  async getVisitsPaginated(params?: ConsultantVisitFilters): Promise<PaginatedResponse<ConsultantVisit>> {
    const response = await apiClient.get<PaginatedResponse<ConsultantVisit>>('/consultant-visits', { params });
    return response.data;
  },

  async getById(id: string | number): Promise<ConsultantVisit> {
    const response = await apiClient.get<{ data: ConsultantVisit }>(`/consultant-visits/${id}`);
    return response.data.data;
  },

  async create(payload: CreateConsultantVisitPayload): Promise<ConsultantVisit> {
    const response = await apiClient.post<{ data: ConsultantVisit }>('/consultant-visits', payload);
    return response.data.data;
  },

  async update(id: string | number, payload: UpdateConsultantVisitPayload): Promise<ConsultantVisit> {
    const response = await apiClient.put<{ data: ConsultantVisit }>(`/consultant-visits/${id}`, payload);
    return response.data.data;
  },

  async delete(id: string | number): Promise<void> {
    await apiClient.delete(`/consultant-visits/${id}`);
  },

  async toggleStatus(id: string | number): Promise<ConsultantVisit> {
    const response = await apiClient.post<{ data: ConsultantVisit }>(`/consultant-visits/${id}/toggle-status`);
    return response.data.data;
  },
};
