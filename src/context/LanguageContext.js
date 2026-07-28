// App language: the one the user picks at sign-up (or later in Settings). Drives
// all UI text via t(), and is sent with chat requests so the AI replies in it.
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSettings, setSettings } from '../localStore';
import { t as translate, isRTL } from '../i18n';
import { api, setApiLang } from '../api';
import { useAuth } from './AuthContext';

const LanguageContext = createContext(null);
export const useLang = () => useContext(LanguageContext);

export function LanguageProvider({ children }) {
  const { token } = useAuth();
  const [lang, setLangState] = useState('en');

  // Restore the saved language on boot.
  useEffect(() => {
    (async () => { try { const s = await getSettings(); if (s && s.lang) { setLangState(s.lang); setApiLang(s.lang); } } catch (_) {} })();
  }, []);
  // Keep the api layer's copy in sync so voice calls carry the right language.
  useEffect(() => { setApiLang(lang); }, [lang]);

  const setLang = useCallback(async (code) => {
    setLangState(code);
    setApiLang(code);
    try { await setSettings({ lang: code }); } catch (_) {}
    try { if (token) await api.settingsLang(code, token); } catch (_) {} // best-effort backend sync
  }, [token]);

  const tr = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: tr, rtl: isRTL(lang) }}>
      {children}
    </LanguageContext.Provider>
  );
}
