"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  ApiError,
  type User,
  authApi,
  clearTokens,
  getAccessToken,
  setTokens,
} from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (
    name: string,
    email: string,
    password: string,
    referralCode?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
}

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore session from stored access token
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const tokens = await authApi.login({ email, password });
    setTokens(tokens.accessToken, tokens.refreshToken);
    const me = await authApi.me();
    setUser(me);
    return me;
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string, referralCode?: string) => {
      const tokens = await authApi.register({ name, email, password, referralCode });
      setTokens(tokens.accessToken, tokens.refreshToken);
      const me = await authApi.me();
      setUser(me);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore — clear locally regardless
    }
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// Re-export for convenience
export { ApiError };
