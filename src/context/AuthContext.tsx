import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { storage } from '../utils/storage';
import { authApi } from '../api/auth';
import { router } from 'expo-router';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (login: string, password: string, userType: 'admin' | 'farm_group' | 'farm_staff') => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load persisted session on app startup
    async function loadSession() {
      try {
        const storedToken = await storage.getToken();
        const storedUser = await storage.getUser();
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
        }
      } catch (error) {
        console.error('Failed to load auth session:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadSession();
  }, []);

  const login = async (login: string, password: string, userType: 'admin' | 'farm_group' | 'farm_staff') => {
    setIsLoading(true);
    try {
      const response = await authApi.login(login, password, userType);
      await storage.setToken(response.token);
      await storage.setUser(response.user);
      setToken(response.token);
      setUser(response.user);
      
      // Navigate to tabs layout home screen
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      // Best effort logout on backend (don't block if network fails)
      await authApi.logout().catch((err) => console.log('Backend logout failed:', err));
    } finally {
      await storage.clearSession();
      setToken(null);
      setUser(null);
      setIsLoading(false);
      router.replace('/(auth)/login');
    }
  };

  const updateUser = async (updatedUser: User) => {
    await storage.setUser(updatedUser);
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
