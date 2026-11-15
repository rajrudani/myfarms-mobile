import apiClient from './client';

export interface SubmitFeedbackPayload {
  subject: string;
  message: string;
  phone?: string;
  category?: 'bug' | 'feature' | 'billing' | 'general' | string;
}

export const supportApi = {
  async submitFeedback(payload: SubmitFeedbackPayload): Promise<{ message: string; data?: { id: number; status: string } }> {
    const response = await apiClient.post<{ message: string; data?: { id: number; status: string } }>('/support/feedback', payload);
    return response.data;
  },
};
