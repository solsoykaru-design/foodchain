import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken } from './api';

interface User {
  id: number; phone: string; name: string; email: string;
  tariff: string; tariffUntil: string | null;
  trialUsed: boolean; cardsUsed: number;
}

interface AuthContextType {
  user: User | null; token: string | null; loading: boolean;
  signIn: (phone: string, code: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const TOKEN_KEY = '@auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(TOKEN_KEY).then(async stored => {
      if (stored) {
        setAuthToken(stored);
        setToken(stored);
        try {
          const data = await api.get('/api/mobile/profile');
          setUser(data);
        } catch { await AsyncStorage.removeItem(TOKEN_KEY); }
      }
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async (phone: string, code: string, name?: string) => {
    const data = await api.post('/api/mobile/auth/verify', { phone, code, name });
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(TOKEN_KEY);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.get('/api/mobile/profile');
      setUser(data);
    } catch { await signOut(); }
  }, [token, signOut]);

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
