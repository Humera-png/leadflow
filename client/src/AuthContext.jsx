import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken, clearToken } from "./api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(() => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    api
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadMe();
    const onUnauthorized = () => setUser(null);
    window.addEventListener("leadflow:unauthorized", onUnauthorized);
    return () => window.removeEventListener("leadflow:unauthorized", onUnauthorized);
  }, [loadMe]);

  const login = async (email, password) => {
    const { token, user: u } = await api.login({ email, password });
    setToken(token);
    setUser(u);
  };

  const signup = async (email, password, name) => {
    const { token, user: u } = await api.signup({ email, password, name });
    setToken(token);
    setUser(u);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
