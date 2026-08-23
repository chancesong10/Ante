export const COLORS = {
  // Clean Minimalist Dark Backgrounds
  background: '#09090B', // Zinc 950 (Almost black)
  backgroundSecondary: '#18181B', // Zinc 900
  card: '#18181B', // Zinc 900
  cardElevated: '#27272A', // Zinc 800
  cardBorder: '#27272A', // Subtle border
  cardBorderHighlight: '#3F3F46',
  
  // Sharp Accent (Clean white as primary for a high-end feel)
  primary: '#FAFAFA',
  primaryGlow: 'transparent',
  primaryMuted: '#27272A',
  primaryDark: '#09090B', // Used for text on primary button
  accentCyan: '#38BDF8',
  accentCyanMuted: 'rgba(56, 189, 248, 0.1)',
  
  // High contrast text
  textPrimary: '#FAFAFA', // Zinc 50
  textSecondary: '#A1A1AA', // Zinc 400
  textMuted: '#8B8B94', // Lightened from Zinc 500 for AA contrast at small sizes
  textDark: '#09090B', // Used when text is ON a white primary background
  
  // Status & Utility Colors (Soft Mid-tone Pastels)
  success: '#4ADE80', // Soft Pastel Green
  successGlow: 'transparent',
  successMuted: 'rgba(74, 222, 128, 0.15)',
  danger: '#F87171', // Soft Pastel Red
  dangerGlow: 'transparent',
  dangerMuted: 'rgba(248, 113, 113, 0.15)',
  dangerBorder: 'rgba(248, 113, 113, 0.3)',
  warning: '#FBBF24', // Soft Pastel Amber
  warningGlow: 'transparent',
  warningMuted: 'rgba(251, 191, 36, 0.15)',
  warningBorder: 'rgba(251, 191, 36, 0.3)',
  info: '#7DD3FC', // Soft Pastel Sky
  neutral: '#27272A',
  neutralBorder: '#3F3F46',
  
  // UI Elements
  tabBar: '#09090B',
  tabBarBorder: '#27272A',
  tabBarInactive: '#71717A',
  divider: '#27272A',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

// Per-game accent colors, distinct from status colors (success/danger/warning/info)
// so a session's game type reads at a glance in lists without relying on the icon glyph.
export const GAME_COLORS = {
  Poker: '#C084FC', // Violet 400
  Blackjack: '#60A5FA', // Blue 400
  'Sports Betting': '#38BDF8', // Sky 400 (matches existing accentCyan usage in that screen)
  General: '#FB923C', // Orange 400
};

export const GAME_COLORS_MUTED = {
  Poker: 'rgba(192, 132, 252, 0.12)',
  Blackjack: 'rgba(96, 165, 250, 0.12)',
  'Sports Betting': 'rgba(56, 189, 248, 0.12)',
  General: 'rgba(251, 146, 60, 0.12)',
};

export const getGameColor = (gameType) => GAME_COLORS[gameType] || COLORS.primary;
export const getGameColorMuted = (gameType) => GAME_COLORS_MUTED[gameType] || COLORS.primaryMuted;

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, // Shadows are mostly invisible in pure dark mode
    shadowRadius: 8,
    elevation: 2,
  },
  neon: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
};
