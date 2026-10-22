import apiClient from './client';
import { Crop, AgroInputProduct, FarmActivityMaster, Buyer, PaginatedResponse } from '../types';

export interface MasterFilters {
  page?: number;
  per_page?: number | 'all';
  search?: string;
  category?: string;
  type?: string;
  status?: 'active' | 'inactive' | 'all';
}

export const mastersApi = {
  // CROPS
  async getCrops(filters?: MasterFilters): Promise<Crop[]> {
    const params = { per_page: 'all', ...filters };
    const response = await apiClient.get<{ data: Crop[] }>('/crops', { params });
    return response.data.data;
  },
  async getPaginatedCrops(filters?: MasterFilters): Promise<PaginatedResponse<Crop>> {
    const response = await apiClient.get<PaginatedResponse<Crop>>('/crops', { params: filters });
    return response.data;
  },
  async createCrop(payload: Partial<Crop>): Promise<Crop> {
    const response = await apiClient.post<{ data: Crop }>('/crops', payload);
    return response.data.data;
  },
  async updateCrop(id: string | number, payload: Partial<Crop>): Promise<Crop> {
    const response = await apiClient.put<{ data: Crop }>(`/crops/${id}`, payload);
    return response.data.data;
  },
  async toggleCropStatus(id: string | number): Promise<Crop> {
    const response = await apiClient.post<{ data: Crop }>(`/crops/${id}/toggle-status`);
    return response.data.data;
  },

  // AGRO INPUT PRODUCTS
  async getInputProducts(filters?: MasterFilters): Promise<AgroInputProduct[]> {
    const params = { per_page: 'all', ...filters };
    const response = await apiClient.get<{ data: AgroInputProduct[] }>('/input-products', { params });
    return response.data.data;
  },
  async getPaginatedInputProducts(filters?: MasterFilters): Promise<PaginatedResponse<AgroInputProduct>> {
    const response = await apiClient.get<PaginatedResponse<AgroInputProduct>>('/input-products', { params: filters });
    return response.data;
  },
  async createInputProduct(payload: Partial<AgroInputProduct>): Promise<AgroInputProduct> {
    const response = await apiClient.post<{ data: AgroInputProduct }>('/input-products', payload);
    return response.data.data;
  },
  async updateInputProduct(id: string | number, payload: Partial<AgroInputProduct>): Promise<AgroInputProduct> {
    const response = await apiClient.put<{ data: AgroInputProduct }>(`/input-products/${id}`, payload);
    return response.data.data;
  },
  async toggleInputProductStatus(id: string | number): Promise<AgroInputProduct> {
    const response = await apiClient.post<{ data: AgroInputProduct }>(`/input-products/${id}/toggle-status`);
    return response.data.data;
  },

  // ACTIVITIES
  async getActivities(filters?: MasterFilters): Promise<FarmActivityMaster[]> {
    const params = { per_page: 'all', ...filters };
    const response = await apiClient.get<{ data: FarmActivityMaster[] }>('/activities', { params });
    return response.data.data;
  },
  async getPaginatedActivities(filters?: MasterFilters): Promise<PaginatedResponse<FarmActivityMaster>> {
    const response = await apiClient.get<PaginatedResponse<FarmActivityMaster>>('/activities', { params: filters });
    return response.data;
  },
  async createActivity(payload: Partial<FarmActivityMaster>): Promise<FarmActivityMaster> {
    const response = await apiClient.post<{ data: FarmActivityMaster }>('/activities', payload);
    return response.data.data;
  },
  async updateActivity(id: string | number, payload: Partial<FarmActivityMaster>): Promise<FarmActivityMaster> {
    const response = await apiClient.put<{ data: FarmActivityMaster }>(`/activities/${id}`, payload);
    return response.data.data;
  },
  async toggleActivityStatus(id: string | number): Promise<FarmActivityMaster> {
    const response = await apiClient.post<{ data: FarmActivityMaster }>(`/activities/${id}/toggle-status`);
    return response.data.data;
  },

  // BUYERS
  async getBuyers(filters?: MasterFilters): Promise<Buyer[]> {
    const params = { per_page: 'all', ...filters };
    const response = await apiClient.get<{ data: Buyer[] }>('/buyers', { params });
    return response.data.data;
  },
  async getPaginatedBuyers(filters?: MasterFilters): Promise<PaginatedResponse<Buyer>> {
    const response = await apiClient.get<PaginatedResponse<Buyer>>('/buyers', { params: filters });
    return response.data;
  },
  async createBuyer(payload: Partial<Buyer>): Promise<Buyer> {
    const response = await apiClient.post<{ data: Buyer }>('/buyers', payload);
    return response.data.data;
  },
  async updateBuyer(id: string | number, payload: Partial<Buyer>): Promise<Buyer> {
    const response = await apiClient.put<{ data: Buyer }>(`/buyers/${id}`, payload);
    return response.data.data;
  },
  async toggleBuyerStatus(id: string | number): Promise<Buyer> {
    const response = await apiClient.post<{ data: Buyer }>(`/buyers/${id}/toggle-status`);
    return response.data.data;
  },
};
