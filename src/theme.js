// OZIRA AI — design system (from the UI mockup)
import { DarkTheme } from '@react-navigation/native';

export const colors = {
  primary: '#E11D48',    // Primary (rose/red)
  secondary: '#FF3D71',  // Secondary
  accent: '#7C3AED',     // Accent (violet)
  bg: '#0B0B12',         // app background (near-black)
  surface: '#161622',    // panels
  card: '#1C1C28',       // cards / bubbles
  cardAlt: '#22222F',
  text: '#F2F2F7',       // primary text
  muted: '#8A8A99',      // secondary text
  border: '#2A2A38',
  success: '#1FA855',
  gold: '#C8930A',
  danger: '#E5484D',
  white: '#FFFFFF',
};

export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const theme = { colors, fonts, spacing, radius };

// React Navigation theme so screen backgrounds match
export const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
    notification: colors.primary,
  },
};
