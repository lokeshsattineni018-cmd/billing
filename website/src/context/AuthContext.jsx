import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('srsf_token');
    const savedUser = localStorage.getItem('srsf_user');

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('srsf_token');
        localStorage.removeItem('srsf_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { token, user: userData } = response.data;

    localStorage.setItem('srsf_token', token);
    localStorage.setItem('srsf_user', JSON.stringify(userData));
    setUser(userData);

    return userData;
  };

  const logout = (skipConfirm = false) => {
    const isExplicitSkip = skipConfirm === true;
    if (!isExplicitSkip) {
      const confirmed = window.confirm('Are you sure you want to sign out? / మీరు లాగ్ అవుట్ అవ్వాలనుకుంటున్నారా?');
      if (!confirmed) return false;
    }
    localStorage.removeItem('srsf_token');
    localStorage.removeItem('srsf_user');
    setUser(null);
    return true;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
