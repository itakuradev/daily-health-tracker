import { createContext, useContext, useState, type ReactNode } from 'react';
import { createApiClient } from '../utils/apiClient';

interface AuthContextValue {
  isLoggedIn: boolean;
  userId: number | null;
  /** 開発用: userId=1 で固定ログイン */
  login: () => void;
  logout: () => void;
  /** ログイン済みの場合のみ有効な apiClient */
  api: ReturnType<typeof createApiClient> | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);

  const login = () => setUserId(1);
  const logout = () => setUserId(null);

  const api = userId !== null ? createApiClient(userId) : null;

  return (
    <AuthContext.Provider value={{ isLoggedIn: userId !== null, userId, login, logout, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
