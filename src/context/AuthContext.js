// OZIRA AI — auth state (Phase 1: your Railway backend + JWT in SecureStore).
// Phase 2: swap this provider's internals for Clerk (useAuth/useUser). The rest
// of the app only uses { user, signIn, signUp, signOut, token } so screens won't change.
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, setToken } from '../api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const TOKEN_KEY = 'ozira_token';

export function AuthProvider({ children }) {
  const [token, setTok] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      if (saved) { setToken(saved); setTok(saved); const me = await api.me(saved); setUser(me.user); }
    } catch (_) { await SecureStore.deleteItemAsync(TOKEN_KEY); }
    setLoading(false);
  })(); }, []);

  async function persist(t) {
    setToken(t); setTok(t);
    await SecureStore.setItemAsync(TOKEN_KEY, t);
    const me = await api.me(t); setUser(me.user);
  }

  const signIn = async (email, password) => { const d = await api.login(email, password); await persist(d.token); };
  const signUp = async (name, email, password) => { const d = await api.register(name, email, password); await persist(d.token); };
  const signOut = async () => { await SecureStore.deleteItemAsync(TOKEN_KEY); setTok(null); setUser(null); setToken(null); };
  const refresh = async () => { if (token) { const me = await api.me(token); setUser(me.user); return me; } };

  return (
    <AuthContext.Provider value={{ token, user, loading, signIn, signUp, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
