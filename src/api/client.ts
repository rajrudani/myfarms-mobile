import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { storage } from '../utils/storage';

// Network status listeners
type NetworkListener = (isOnline: boolean) => void;
const networkListeners = new Set<NetworkListener>();

export const onNetworkStatusChange = (listener: NetworkListener) => {
  networkListeners.add(listener);
  return () => {
    networkListeners.delete(listener);
  };
};

export const notifyNetworkStatus = (isOnline: boolean) => {
  networkListeners.forEach((listener) => {
    try {
      listener(isOnline);
    } catch (e) {
      console.warn('Error in network listener:', e);
    }
  });
};

// Dynamically resolve base URL to point to Laravel server in development
const getBaseUrl = () => {
  // If defined in environment, use it
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // Expo Go developer server host detection
  const debuggerHost = Constants.expoConfig?.hostUri;
  const host = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
  
  // Fallback to localhost (port 8000 is standard for Laravel)
  return `http://${host}:8000/api`;
};

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 12000, // 12 seconds default timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Inject authentication token on every request
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await storage.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

interface RetryableConfig extends InternalAxiosRequestConfig {
  __isRetry?: boolean;
}

// Global response error handler with automatic retry on transient read failures
apiClient.interceptors.response.use(
  (response) => {
    // Notify network listeners that we are online
    notifyNetworkStatus(true);
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;

    // Detect offline or unreachable server
    const isNetworkError =
      error.message === 'Network Error' ||
      error.code === 'ECONNABORTED' ||
      !error.response;

    if (isNetworkError) {
      notifyNetworkStatus(false);

      // Auto-retry once for idempotent GET requests after a 1.2s delay
      if (config && config.method?.toLowerCase() === 'get' && !config.__isRetry) {
        config.__isRetry = true;
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return apiClient(config);
      }
    }

    // Handle 401 Unauthorized: token expired or revoked
    if (error.response && error.response.status === 401) {
      await storage.clearSession();
    }

    return Promise.reject(error);
  }
);

// Helper to extract clean error message from Laravel API error response
export const extractErrorMessage = (error: any, fallback = 'An unexpected error occurred.'): string => {
  if (!error) return fallback;

  // Timeout error
  if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
    return 'Connection timed out. Please check your farm network and retry.';
  }

  // Network error (no response)
  if (error.message === 'Network Error' || !error.response) {
    return 'Server unreachable. Please check your internet connectivity.';
  }

  const status = error.response.status;
  const data = error.response.data;

  // Subscription expired / payment required
  if (status === 402) {
    return 'Your Farm Group subscription has expired. Please contact support or renew.';
  }

  // Forbidden / unauthorized role
  if (status === 403) {
    return data?.message || 'Access denied. You do not have permission for this action.';
  }

  // Not found
  if (status === 404) {
    return data?.message || 'The requested resource was not found.';
  }

  // Check for Laravel validation errors object { errors: { field: ['message'] } }
  if (data?.errors && typeof data.errors === 'object') {
    const firstField = Object.keys(data.errors)[0];
    if (firstField && Array.isArray(data.errors[firstField]) && data.errors[firstField].length > 0) {
      return data.errors[firstField][0];
    }
  }

  return error.message || fallback;
};

export const getAbsoluteImageUrl = (urlPath?: string | null): string | undefined => {
  if (!urlPath) return undefined;
  if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) {
    return urlPath;
  }
  const apiBase = getBaseUrl().replace('/api', '');
  return `${apiBase}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
};

export default apiClient;
export { getBaseUrl };
