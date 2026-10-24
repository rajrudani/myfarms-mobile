import apiClient from './client';
import { DashboardSummary, DashboardSearchResponse } from '../types';

export const dashboardApi = {
  /**
   * Get operational dashboard summary (Today's reminders, activities, quick counts)
   */
  async getSummary(): Promise<DashboardSummary> {
    const response = await apiClient.get<DashboardSummary>('/dashboard/summary');
    return response.data;
  },

  /**
   * Global search across farms, sales, purchases, payments, staff, notes, visits, shops
   */
  async search(query: string): Promise<DashboardSearchResponse> {
    const response = await apiClient.get<DashboardSearchResponse>('/dashboard/search', {
      params: { query },
    });
    return response.data;
  },
};

