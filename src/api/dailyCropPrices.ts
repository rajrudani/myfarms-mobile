import apiClient from './client';
import { DailyCropPrice, DailyCropPriceMeta, PaginatedResponse } from '../types';

export interface DailyCropPriceFilters {
  state?: string;
  district?: string;
  commodity?: string;
  search?: string;
  page?: number;
  per_page?: number | string;
}

export const dailyCropPricesApi = {
  async getPrices(params?: DailyCropPriceFilters): Promise<DailyCropPrice[]> {
    const response = await apiClient.get<PaginatedResponse<DailyCropPrice> | { data: DailyCropPrice[] }>('/daily-crop-prices', {
      params: { per_page: 'all', ...params },
    });
    return Array.isArray(response.data) ? response.data : response.data.data;
  },

  async getPricesPaginated(params?: DailyCropPriceFilters): Promise<PaginatedResponse<DailyCropPrice>> {
    const response = await apiClient.get<PaginatedResponse<DailyCropPrice>>('/daily-crop-prices', { params });
    return response.data;
  },

  async getMeta(state?: string): Promise<DailyCropPriceMeta> {
    const response = await apiClient.get<DailyCropPriceMeta>('/daily-crop-prices/meta', {
      params: state ? { state } : undefined,
    });
    return response.data;
  },
};
