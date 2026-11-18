import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const LOCALE_KEY = 'app_locale';

export type MandiUnit = 'kg' | 'maund_20' | 'maund_40' | 'quintal';

export interface MandiPreferences {
  state?: string;
  district?: string;
  unit?: MandiUnit;
}

export const storage = {
  async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async getToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  },

  async removeToken(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },

  async setUser(user: any): Promise<void> {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },

  async getUser(): Promise<any | null> {
    const userStr = await SecureStore.getItemAsync(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  async removeUser(): Promise<void> {
    await SecureStore.deleteItemAsync(USER_KEY);
  },

  async setLocale(locale: string): Promise<void> {
    await SecureStore.setItemAsync(LOCALE_KEY, locale);
  },

  async getLocale(): Promise<string | null> {
    return await SecureStore.getItemAsync(LOCALE_KEY);
  },

  async setPushToken(token: string): Promise<void> {
    await SecureStore.setItemAsync('push_token', token);
  },

  async getPushToken(): Promise<string | null> {
    return await SecureStore.getItemAsync('push_token');
  },

  async setMandiPreferences(prefs: MandiPreferences): Promise<void> {
    await SecureStore.setItemAsync('mandi_prefs', JSON.stringify(prefs));
  },

  async getMandiPreferences(): Promise<MandiPreferences | null> {
    const raw = await SecureStore.getItemAsync('mandi_prefs');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async clearSession(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  },
};
