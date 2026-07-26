// OZIRA AI — design system with light + dark palettes.
import { DarkTheme, DefaultTheme } from '@react-navigation/native';

// Brand colours stay the same in both themes; only neutrals change.
const brand = {
  primary: '#E11D48',
  secondary: '#FF3D71',
  accent: '#7C3AED',
  success: '#1FA855',
  gold: '#C8930A',
  danger: '#E5484D',
  white: '#FFFFFF',
};

export const darkColors = {
  ...brand,
  bg: '#0B0B12',
  surface: '#161622',
  card: '#1C1C28',
  cardAlt: '#22222F',
  text: '#F2F2F7',
  muted: '#8A8A99',
  border: '#2A2A38',
};

export const lightColors = {
  ...brand,
  bg: '#F6F7FB',
  surface: '#FFFFFF',
  card: '#EFEFF5',
  cardAlt: '#E7E7EF',
  text: '#15151C',
  muted: '#6A6A78',
  border: '#E3E3EB',
};

export function getPalette(mode) { return mode === 'light' ? lightColors : darkColors; }

// Default export used by screens not yet converted to the theme hook (dark).
export const colors = darkColors;

export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const theme = { colors, fonts, spacing, radius };

export function navThemeFor(mode) {
  const c = getPalette(mode);
  const base = mode === 'light' ? DefaultTheme : DarkTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: c.bg,
      card: c.surface,
      text: c.text,
      border: c.border,
      primary: c.primary,
      notification: c.primary,
    },
  };
}

// Back-compat static nav theme (dark).
export const navTheme = navThemeFor('dark');
