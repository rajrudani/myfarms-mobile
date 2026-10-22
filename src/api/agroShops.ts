import apiClient from './client';
import { AgroShop, AgroShopPurchase, AgroShopPayment, AgroInputProduct, PaginatedResponse } from '../types';

export interface CreateShopPayload {
  name: string;
  contact_name?: string;
  phone?: string;
  address?: string;
  notes?: string;
  is_active?: boolean;
}

export interface PurchaseItemPayload {
  agro_input_product_id: number | string;
  quantity: number;
  unit: string;
  unit_price: number;
}

export interface RecordPurchasePayload {
  date: string; // YYYY-MM-DD
  notes?: string;
  bill_photo_path?: string | null;
  items: PurchaseItemPayload[];
}

export interface RecordPaymentPayload {
  agro_shop_purchase_id?: number | string | null;
  date: string; // YYYY-MM-DD
  amount: number;
  payment_method: string;
  notes?: string;
}

export interface AgroShopFilters {
  search?: string;
  is_active?: boolean | string;
  page?: number;
  per_page?: number | 'all';
}

export const agroShopsApi = {
  async getShops(params?: AgroShopFilters): Promise<AgroShop[]> {
    const response = await apiClient.get<{ data: AgroShop[] }>('/agro-shops', {
      params: { per_page: 'all', ...params },
    });
    return response.data.data;
  },

  async getShopsPaginated(params?: AgroShopFilters): Promise<PaginatedResponse<AgroShop>> {
    const response = await apiClient.get<PaginatedResponse<AgroShop>>('/agro-shops', { params });
    return response.data;
  },

  async createShop(payload: CreateShopPayload): Promise<AgroShop> {
    const response = await apiClient.post<{ data: AgroShop }>('/agro-shops', payload);
    return response.data.data;
  },

  async updateShop(id: string | number, payload: Partial<CreateShopPayload>): Promise<AgroShop> {
    const response = await apiClient.put<{ data: AgroShop }>(`/agro-shops/${id}`, payload);
    return response.data.data;
  },

  async deleteShop(id: string | number): Promise<void> {
    await apiClient.delete(`/agro-shops/${id}`);
  },

  async toggleShopStatus(id: string | number): Promise<AgroShop> {
    const response = await apiClient.post<{ data: AgroShop }>(`/agro-shops/${id}/toggle-status`);
    return response.data.data;
  },

  async getShopSummary(id: string | number): Promise<{ total_purchase: number; total_paid: number; balance: number }> {
    const response = await apiClient.get<{ data: { total_purchase: number; total_paid: number; balance: number } }>(`/agro-shops/${id}/summary`);
    return response.data.data;
  },

  async getPurchases(shopId: string | number, params?: { date?: string; date_from?: string; date_to?: string }): Promise<AgroShopPurchase[]> {
    const response = await apiClient.get<{ data: AgroShopPurchase[] }>(`/agro-shops/${shopId}/purchases`, {
      params: { per_page: 'all', ...params },
    });
    return response.data.data;
  },

  async getPurchasesPaginated(shopId: string | number, params?: { page?: number; per_page?: number; date?: string; date_from?: string; date_to?: string }): Promise<PaginatedResponse<AgroShopPurchase>> {
    const response = await apiClient.get<PaginatedResponse<AgroShopPurchase>>(`/agro-shops/${shopId}/purchases`, { params });
    return response.data;
  },

  async createPurchase(shopId: string | number, payload: RecordPurchasePayload): Promise<AgroShopPurchase> {
    const response = await apiClient.post<{ data: AgroShopPurchase }>(`/agro-shops/${shopId}/purchases`, payload);
    return response.data.data;
  },

  async deletePurchase(id: string | number): Promise<void> {
    await apiClient.delete(`/agro-shop-purchases/${id}`);
  },

  async getPayments(shopId: string | number, params?: { date?: string; payment_method?: string }): Promise<AgroShopPayment[]> {
    const response = await apiClient.get<{ data: AgroShopPayment[] }>(`/agro-shops/${shopId}/payments`, {
      params: { per_page: 'all', ...params },
    });
    return response.data.data;
  },

  async getPaymentsPaginated(shopId: string | number, params?: { page?: number; per_page?: number; date?: string; payment_method?: string }): Promise<PaginatedResponse<AgroShopPayment>> {
    const response = await apiClient.get<PaginatedResponse<AgroShopPayment>>(`/agro-shops/${shopId}/payments`, { params });
    return response.data;
  },

  async createPayment(shopId: string | number, payload: RecordPaymentPayload): Promise<AgroShopPayment> {
    const response = await apiClient.post<{ data: AgroShopPayment }>(`/agro-shops/${shopId}/payments`, payload);
    return response.data.data;
  },

  async deletePayment(id: string | number): Promise<void> {
    await apiClient.delete(`/agro-shop-payments/${id}`);
  },

  async getInputProducts(): Promise<AgroInputProduct[]> {
    const response = await apiClient.get<{ data: AgroInputProduct[] }>('/agro-input-products');
    return response.data.data;
  },
};
