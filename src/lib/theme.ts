/**
 * Solo-leveling inspired visual language: near-black canvas, electric blue and
 * gold accents, glowing cards. Centralized so every screen looks consistent.
 */

export const colors = {
  bg: '#05060a',
  bgElevated: '#0c0f18',
  card: '#111524',
  cardAlt: '#161b2e',
  border: '#232a44',
  text: '#f5f7ff',
  textDim: '#9aa3c0',
  textFaint: '#5f6884',
  accent: '#3fa9ff', // system blue
  accentSoft: '#1b3a5c',
  gold: '#ffcc4d',
  danger: '#ff5470',
  success: '#39d98a',
  purple: '#a06bff',
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
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const font = {
  h1: { fontSize: 30, fontWeight: '800' as const, color: colors.text },
  h2: { fontSize: 23, fontWeight: '800' as const, color: colors.text },
  h3: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  dim: { fontSize: 14, color: colors.textDim },
  small: { fontSize: 12, color: colors.textFaint },
};

export function glow(color: string = colors.accent, radiusPx = 16) {
  return {
    shadowColor: color,
    shadowOpacity: 0.55,
    shadowRadius: radiusPx,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  };
}
