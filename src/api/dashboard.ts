import apiClient from './client';
import { DashboardSummary } from '../types';

export const dashboardApi = {
  /**
   * Get operational dashboard summary (Today's reminders, activities, quick counts)
   */
  async getSummary(): Promise<DashboardSummary> {
    const response = await apiClient.get<DashboardSummary>('/dashboard/summary');
    return response.data;
  },
};
