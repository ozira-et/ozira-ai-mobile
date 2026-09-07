// OZIRA AI — auth state, backed by Supabase Auth.
// The `token` here is Supabase's access token; the backend verifies it.
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../supabase';
import { api, absUrl, setToken } from '../api';
import { getProfile as getLocalProfile, replaceProfile as replaceLocalProfile } from '../localStore';
import { captureAccountSession, isCurrentAccount, assertCurrentAccount } from '../accountSession';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [token, setTok] = useState(null);
  const [user, setUser] = useState(null);       // { id, email, ...profile }
  const [loading, setLoading] = useState(true);
  const [accountGeneration, setAccountGeneration] = useState(0);
  const profileRevision = useRef(0);

  // Load the profile row for the signed-in user.
  async function loadProfile(session, scope = captureAccountSession()) {
    if (!session || !isCurrentAccount(scope)) return;
    const revision = ++profileRevision.current;
    const authUser = session.user;
    let profile = {};
    try {
      const { data } = await supabase
        .from('profiles').select('*').eq('id', authUser.id).single();
      if (data) profile = data;
    } catch (_) {}
    if (!isCurrentAccount(scope) || revision !== profileRevision.current) return;
    try {
      const local = await getLocalProfile(scope);
      profile = { ...profile, ...local };
      const result = await api.profile(session.access_token);
      let accountProfile = result.profile || {};
      if (!isCurrentAccount(scope) || revision !== profileRevision.current) return;
      // Never infer ownership of an old device profile from the current login.
      if (accountProfile.avatar) accountProfile.avatar = absUrl(accountProfile.avatar);
      await replaceLocalProfile(accountProfile, authUser.id, scope);
      profile = { ...profile, ...accountProfile };
    } catch (_) {}
    if (isCurrentAccount(scope) && revision === profileRevision.current) {
      setUser({ ...profile, id: authUser.id, email: authUser.email });
    }
  }

  useEffect(() => {
    let active = true;
    let eventReceived = false;
    const activate = session => {
      if (!active) return;
      profileRevision.current++;
      setToken(session?.access_token || null, session?.user?.id || null);
      const scope = captureAccountSession();
      setAccountGeneration(scope.generation);
      setTok(session?.access_token || null);
      setUser(current => {
        if (!session) return null;
        // Token refresh for the same account must not erase a loaded profile or
        // an in-progress draft while the background profile request catches up.
        if (current?.id === session.user.id) return { ...current, id: session.user.id, email: session.user.email };
        return { id: session.user.id, email: session.user.email };
      });
      setLoading(false);
      if (session) void loadProfile(session, scope);
    };
    // 1) Restore any existing session on boot. Never let a slow profile fetch
    // block the app on the loading spinner — resolve loading first, then load
    // the profile in the background.
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!eventReceived) activate(session);
      } catch (_) {}
      if (active) setLoading(false);
    })();

    // 2) React to sign-in / sign-out / token-refresh.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      eventReceived = true;
      activate(session);
    });
    return () => { active = false; profileRevision.current++; sub.subscription.unsubscribe(); };
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

  const signOut = async () => {
    setToken(null, null); profileRevision.current++;
    setAccountGeneration(captureAccountSession().generation);
    setTok(null); setUser(null);
    await supabase.auth.signOut();
  };

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
    const scope = captureAccountSession();
    const { data: { session } } = await supabase.auth.getSession();
    if (isCurrentAccount(scope)) await loadProfile(session, scope);
  };

  // Update the shared account profile used by mobile and web.
  const updateProfile = async (patch) => {
    if (!user?.id) return;
    const scope = captureAccountSession();
    assertCurrentAccount(scope);
    if (scope.ownerId !== user.id) return;
    const result = await api.saveProfile(patch, token);
    const saved = { ...(result.profile || {}) };
    if (saved.avatar) saved.avatar = absUrl(saved.avatar);
    await replaceLocalProfile(saved, user.id, scope);
    assertCurrentAccount(scope);
    setUser(current => ({ ...(current || {}), ...saved }));
    return saved;
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, signIn, signUp, signOut, refresh, updateProfile, sendResetCode, resetPassword }}>
      <React.Fragment key={accountGeneration}>{children}</React.Fragment>
    </AuthContext.Provider>
  );
}
