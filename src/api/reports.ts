import apiClient from './client';
import {
  ReportFiltersData,
  AttendanceReportResponse,
  PaymentReportResponse,
  ActivityReportResponse,
  ExpenseReportResponse,
} from '../types';

export const reportsApi = {
  async getFilters(): Promise<ReportFiltersData> {
    const response = await apiClient.get<ReportFiltersData>('/reports/filters');
    return response.data;
  },

  async getAttendanceReport(params: {
    farm_id?: number | string;
    farm_staff_id?: number | string;
    month?: number;
    year?: number;
  }): Promise<AttendanceReportResponse> {
    const response = await apiClient.get<AttendanceReportResponse>('/reports/attendance', { params });
    return response.data;
  },

  async getPaymentReport(params: {
    farm_staff_id?: number | string;
    from_date?: string;
    to_date?: string;
  }): Promise<PaymentReportResponse> {
    const response = await apiClient.get<PaymentReportResponse>('/reports/payment', { params });
    return response.data;
  },

  async getActivityReport(params: {
    farm_id?: number | string;
    crop_cycle_id?: number | string;
    from_date?: string;
    to_date?: string;
  }): Promise<ActivityReportResponse> {
    const response = await apiClient.get<ActivityReportResponse>('/reports/activity', { params });
    return response.data;
  },

  async getExpenseReport(params: {
    farm_id?: number | string;
    crop_cycle_id?: number | string;
    from_date?: string;
    to_date?: string;
  }): Promise<ExpenseReportResponse> {
    const response = await apiClient.get<ExpenseReportResponse>('/reports/expense', { params });
    return response.data;
  },
};
