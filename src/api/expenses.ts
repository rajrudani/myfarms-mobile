import apiClient from './client';
import { FarmExpense, PaginatedResponse } from '../types';

export interface FarmExpenseFilters {
  farm_id?: string | number;
  crop_cycle_id?: string | number;
  category?: string;
  expense_category?: string;
  payment_status?: string;
  payment_method?: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number | 'all';
}

export const expensesApi = {
  async getAll(params?: FarmExpenseFilters): Promise<FarmExpense[]> {
    const response = await apiClient.get<{ data: FarmExpense[] }>('/expenses', {
      params: { per_page: 'all', ...params },
    });
    return response.data.data;
  },

  async getPaginated(params?: FarmExpenseFilters): Promise<PaginatedResponse<FarmExpense>> {
    const response = await apiClient.get<PaginatedResponse<FarmExpense>>('/expenses', { params });
    return response.data;
  },

  async getById(id: string | number): Promise<FarmExpense> {
    const response = await apiClient.get<{ data: FarmExpense }>(`/expenses/${id}`);
    return response.data.data;
  },

  async create(expense: Partial<FarmExpense>): Promise<FarmExpense> {
    const response = await apiClient.post<{ data: FarmExpense }>('/expenses', expense);
    return response.data.data;
  },

  async update(id: string | number, expense: Partial<FarmExpense>): Promise<FarmExpense> {
    const response = await apiClient.put<{ data: FarmExpense }>(`/expenses/${id}`, expense);
    return response.data.data;
  },

  async delete(id: string | number): Promise<void> {
    await apiClient.delete(`/expenses/${id}`);
  },
};
