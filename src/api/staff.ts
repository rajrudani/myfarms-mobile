import apiClient from './client';
import { StaffMember, PaginatedResponse } from '../types';

export interface StaffFilters {
  page?: number;
  per_page?: number | 'all';
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  farm_id?: number | string;
  role?: string;
}

export const staffApi = {
  async getAll(filters?: StaffFilters): Promise<StaffMember[]> {
    const params = { per_page: 'all', ...filters };
    const response = await apiClient.get<PaginatedResponse<StaffMember> | { data: StaffMember[] }>('/farm-staff', { params });
    return response.data.data;
  },

  async getPaginated(filters?: StaffFilters): Promise<PaginatedResponse<StaffMember>> {
    const response = await apiClient.get<PaginatedResponse<StaffMember>>('/farm-staff', { params: filters });
    return response.data;
  },

  async getById(id: string | number): Promise<StaffMember> {
    const response = await apiClient.get<{ data: StaffMember }>(`/farm-staff/${id}`);
    return response.data.data;
  },

  async create(staff: Partial<StaffMember> & { roles: string[] }): Promise<StaffMember> {
    const response = await apiClient.post<{ data: StaffMember }>('/farm-staff', staff);
    return response.data.data;
  },

  async update(id: string | number, staff: Partial<StaffMember>): Promise<StaffMember> {
    const response = await apiClient.put<{ data: StaffMember }>(`/farm-staff/${id}`, staff);
    return response.data.data;
  },

  async delete(id: string | number): Promise<void> {
    await apiClient.delete(`/farm-staff/${id}`);
  },

  async toggleStatus(id: string | number): Promise<StaffMember> {
    const response = await apiClient.post<{ data: StaffMember }>(`/farm-staff/${id}/toggle-status`);
    return response.data.data;
  },

  async assignFarm(id: string | number, farmId: number): Promise<StaffMember> {
    const response = await apiClient.post<{ data: StaffMember }>(`/farm-staff/${id}/assign-farm`, { farm_id: farmId });
    return response.data.data;
  },

  async unassignFarm(id: string | number, farmId: number): Promise<StaffMember> {
    const response = await apiClient.post<{ data: StaffMember }>(`/farm-staff/${id}/unassign-farm`, { farm_id: farmId });
    return response.data.data;
  },

  async settlePayments(id: string | number, data: { settled_on: string; notes?: string }): Promise<StaffMember> {
    const response = await apiClient.post<{ data: StaffMember }>(`/farm-staff/${id}/settle-payments`, data);
    return response.data.data;
  },
};
