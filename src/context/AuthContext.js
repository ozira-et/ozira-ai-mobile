// OZIRA AI — auth state, backed by Supabase Auth.
// The `token` here is Supabase's access token; the backend verifies it.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { setToken } from '../api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [token, setTok] = useState(null);
  const [user, setUser] = useState(null);       // { id, email, ...profile }
  const [loading, setLoading] = useState(true);

  // Load the profile row for the signed-in user.
  async function loadProfile(session) {
    if (!session) { setUser(null); return; }
    const authUser = session.user;
    let profile = {};
    try {
      const { data } = await supabase
        .from('profiles').select('*').eq('id', authUser.id).single();
      if (data) profile = data;
    } catch (_) {}
    setUser({ id: authUser.id, email: authUser.email, ...profile });
  }

  useEffect(() => {
    // 1) Restore any existing session on boot. Never let a slow profile fetch
    // block the app on the loading spinner — resolve loading first, then load
    // the profile in the background.
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) { setToken(session.access_token); setTok(session.access_token); loadProfile(session); }
      } catch (_) {}
      setLoading(false);
    })();

    // 2) React to sign-in / sign-out / token-refresh.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) { setToken(session.access_token); setTok(session.access_token); await loadProfile(session); }
      else { setToken(null); setTok(null); setUser(null); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const signUp = async (name, email, password, lang, gender) => {
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { name, lang: lang || 'en', gender: gender || '' } },
    });
    if (error) throw new Error(error.message);
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  // --- Password reset (email OTP code, then set a new password) ---
  // 1) Send a 6-digit code to the email.
  const sendResetCode = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { shouldCreateUser: false },
    });
    if (error) throw new Error(error.message);
  };
  // 2) Verify the code (this signs the user in), then set the new password.
  const resetPassword = async (email, code, newPassword) => {
    const { error: vErr } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (vErr) throw new Error(vErr.message);
    const { error: uErr } = await supabase.auth.updateUser({ password: newPassword });
    if (uErr) throw new Error(uErr.message);
  };

  // Re-fetch the profile row (after edits on the Profile screen, etc.)
  const refresh = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await loadProfile(session);
  };

  // Update the user's profile row in Supabase.
  const updateProfile = async (patch) => {
    if (!user?.id) return;
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) throw new Error(error.message);
    await refresh();
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, signIn, signUp, signOut, refresh, updateProfile, sendResetCode, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}
