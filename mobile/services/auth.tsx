import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://foodchain-qpxh.onrender.com';

interface User {
  id: number;
  phone: string;
  name: string;
  freeAttempts: number;
  tariff: string;
  isSubscribed: boolean;
  tariffUntil: string | null;
  referralCode: string;
  pdfVariant: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string) => Promise<string>;
  verifyRegister: (phone: string, code: string, password: string) => Promise<void>;
  forgotPassword: (phone: string) => Promise<string>;
  resetPassword: (phone: string, code: string, newPassword: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updatePdfVariant: (variant: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('auth_user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Load auth error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (phone: string, password: string) => {
    const res = await fetch(`${API_URL}/api/mobile/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка входа');
    
    await AsyncStorage.setItem('auth_token', data.token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (phone: string, password: string): Promise<string> => {
    const res = await fetch(`${API_URL}/api/mobile/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка регистрации');
    return data.code;
  };

  const verifyRegister = async (phone: string, code: string, password: string) => {
    const res = await fetch(`${API_URL}/api/mobile/auth/verify-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка подтверждения');
    
    await AsyncStorage.setItem('auth_token', data.token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const forgotPassword = async (phone: string): Promise<string> => {
    const res = await fetch(`${API_URL}/api/mobile/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка');
    return data.code;
  };

  const resetPassword = async (phone: string, code: string, newPassword: string) => {
    const res = await fetch(`${API_URL}/api/mobile/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка');
  };

  const logout = async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  };

  const updatePdfVariant = async (variant: number) => {
    if (!token) return;
    try {
      const v = Math.max(1, Math.min(6, variant));
      const res = await fetch(`${API_URL}/api/mobile/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pdf_variant: v }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        await AsyncStorage.setItem('auth_user', JSON.stringify(data));
      }
    } catch (e) {
      console.error('Update pdfVariant error:', e);
    }
  };

  const refreshProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/mobile/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        await AsyncStorage.setItem('auth_user', JSON.stringify(data));
      }
    } catch (e) {
      console.error('Refresh profile error:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, verifyRegister, forgotPassword, resetPassword, logout, refreshProfile, updatePdfVariant }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

export { API_URL };
