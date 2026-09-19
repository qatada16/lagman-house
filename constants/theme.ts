export const colors = {
  background: '#FFF9EC',
  surfaceSidebar: '#FDF6E3',
  accentDark: '#00243E',
  action: '#B16217',
  surfaceHighlight: '#D8B27A',
  surfaceMuted: '#4F4E4A',
  white: '#FFFFFF',
  border: '#E9DDC4',
  borderStrong: '#D8B27A',
  textPrimary: '#1F1E1B',
  textSecondary: '#4F4E4A',
  textOnDark: '#FFF9EC',
  danger: '#9E2A2B',
  success: '#2F6B3A',
  warning: '#B16217',
  info: '#00243E',
  disabled: '#C9C2B4',
  overlay: 'rgba(31, 30, 27, 0.45)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
} as const;

export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.textPrimary },
  heading: { fontSize: 18, fontWeight: '700' as const, color: colors.textPrimary },
  subheading: { fontSize: 15, fontWeight: '600' as const, color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.textPrimary },
  small: { fontSize: 13, fontWeight: '400' as const, color: colors.textSecondary },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.textSecondary, letterSpacing: 0.4 },
  mono: { fontSize: 13, fontFamily: 'monospace' as const, color: colors.textPrimary },
} as const;

export const shadow = {
  card: {
    shadowColor: '#3A2C10',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;

export const layout = {
  sidebarWidth: 220,
  railWidth: 64,
  wideBreakpoint: 768,
  maxContentWidth: 1100,
} as const;
