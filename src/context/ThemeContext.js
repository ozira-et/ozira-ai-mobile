import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import { getPalette } from '../theme';
import { getTheme, setTheme as persistTheme } from '../localStore';

const ThemeCtx = createContext({
  mode: 'dark',
  resolved: 'dark',
  colors: getPalette('dark'),
  setMode: () => {},
  cycle: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('dark'); // 'dark' | 'light' | 'system'
  const [sys, setSys] = useState(Appearance.getColorScheme());

  useEffect(() => {
    (async () => { try { setModeState(await getTheme()); } catch (_) {} })();
  }, []);
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSys(colorScheme));
    return () => sub.remove();
  }, []);

  function setMode(m) { setModeState(m); persistTheme(m); }
  function cycle() { setMode(mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark'); }

  const resolved = mode === 'system' ? (sys === 'light' ? 'light' : 'dark') : (mode === 'light' ? 'light' : 'dark');

  return (
    <ThemeCtx.Provider value={{ mode, resolved, colors: getPalette(resolved), setMode, cycle, toggle: cycle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useColors() { return useContext(ThemeCtx).colors; }
export function useThemeMode() {
  const c = useContext(ThemeCtx);
  return { mode: c.mode, resolved: c.resolved, setMode: c.setMode, cycle: c.cycle, toggle: c.toggle };
}
