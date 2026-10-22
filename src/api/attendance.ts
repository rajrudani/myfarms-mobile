import apiClient from './client';
import { StaffAttendance, PaginatedResponse } from '../types';

export interface AttendanceFilters {
  page?: number;
  per_page?: number | 'all';
  date?: string;
  farm_id?: number | string;
  staff_id?: number | string;
  status?: 'present' | 'absent' | 'half_day' | 'all';
}

export interface MarkAttendanceData {
  farm_staff_id: number;
  farm_id?: number | null;
  date: string;
  status: 'present' | 'absent' | 'half_day';
  notes?: string | null;
}

export interface BulkMarkAttendanceData {
  date: string;
  farm_id?: number | null;
  records: {
    farm_staff_id: number;
    status: 'present' | 'absent' | 'half_day';
    notes?: string | null;
  }[];
}

export const attendanceApi = {
  async getAll(filters?: AttendanceFilters): Promise<StaffAttendance[]> {
    const params = { per_page: 'all', ...filters };
    const response = await apiClient.get<PaginatedResponse<StaffAttendance> | { data: StaffAttendance[] }>('/staff-attendances', { params });
    return response.data.data;
  },

  async getPaginated(filters?: AttendanceFilters): Promise<PaginatedResponse<StaffAttendance>> {
    const response = await apiClient.get<PaginatedResponse<StaffAttendance>>('/staff-attendances', { params: filters });
    return response.data;
  },

  async mark(data: MarkAttendanceData): Promise<StaffAttendance> {
    const response = await apiClient.post<{ data: StaffAttendance }>('/staff-attendances', data);
    return response.data.data;
  },

  async update(id: string | number, data: Partial<MarkAttendanceData>): Promise<StaffAttendance> {
    const response = await apiClient.put<{ data: StaffAttendance }>(`/staff-attendances/${id}`, data);
    return response.data.data;
  },

  async bulkMark(data: BulkMarkAttendanceData): Promise<{ success: boolean; message: string; count: number }> {
    const response = await apiClient.post<{ success: boolean; message: string; count: number }>('/staff-attendances/bulk', data);
    return response.data;
  },
};
