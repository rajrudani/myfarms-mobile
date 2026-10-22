export const colors = {
  // Brand Emeralds
  primary: '#059669',
  primaryLight: '#10b981',
  primaryDark: '#047857',
  primaryDeep: '#064e3b',
  primarySurface: '#ecfdf5',
  primaryBorder: '#a7f3d0',

  // Amber / Sun Accents
  accent: '#f59e0b',
  accentLight: '#fbbf24',
  accentDark: '#d97706',
  accentSurface: '#fffbeb',
  accentBorder: '#fde68a',

  // Neutrals / Slates
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate300: '#cbd5e1',
  slate200: '#e2e8f0',
  slate100: '#f1f5f9',
  slate50: '#f8fafc',
  white: '#ffffff',

  // Semantic Status
  success: '#10b981',
  successSurface: '#ecfdf5',
  successBorder: '#a7f3d0',
  successText: '#047857',

  warning: '#f59e0b',
  warningSurface: '#fffbeb',
  warningBorder: '#fde68a',
  warningText: '#b45309',

  danger: '#ef4444',
  dangerSurface: '#fef2f2',
  dangerBorder: '#fecaca',
  dangerText: '#b91c1c',

  info: '#3b82f6',
  infoSurface: '#eff6ff',
  infoBorder: '#bfdbfe',
  infoText: '#1d4ed8',

  purple: '#8b5cf6',
  purpleSurface: '#f5f3ff',
  purpleBorder: '#ddd6fe',
  purpleText: '#6d28d9',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
};

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 9999,
};

export const typography = {
  hero: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: colors.slate900,
    letterSpacing: -0.5,
  },
  title1: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.slate900,
    letterSpacing: -0.3,
  },
  title2: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.slate800,
  },
  title3: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.slate800,
  },
  body: {
    fontSize: 14,
    color: colors.slate700,
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 12,
    color: colors.slate500,
    lineHeight: 16,
  },
  metric: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: colors.slate900,
    letterSpacing: -0.5,
  },
  caption: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.slate500,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
};

export const shadows = {
  subtle: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  glowPrimary: {
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
};
