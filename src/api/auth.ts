import { Platform } from 'react-native';
import apiClient from './client';
import { LoginResponse, User } from '../types';

export const authApi = {
  async login(
    login: string,
    password: string,
    userType: 'admin' | 'farm_group' | 'farm_staff'
  ): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/login', {
      login,
      password,
      device_name: Platform.OS === 'ios' ? 'iOS App' : 'Android App',
      user_type: userType,
    });
    return response.data;
  },

  async me(): Promise<User> {
    const response = await apiClient.get<User>('/me');
    return response.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/logout');
  },

  async updateProfile(payload: { name: string; email?: string; username?: string }): Promise<User> {
    const response = await apiClient.put<{ message: string; user: User }>('/profile', payload);
    return response.data.user;
  },

  async changePassword(payload: { current_password: string; password: string; password_confirmation: string }): Promise<void> {
    await apiClient.post('/profile/password', payload);
  },
};
