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
  // Emphasis border for surfaces that should read as lifted above a plain
  // card — the Ante+ card, the paywall, an active session. Kept as a white
  // wash rather than a hue so it adds hierarchy without adding a colour.
  primaryGlow: 'rgba(250, 250, 250, 0.16)',
  primaryMuted: '#27272A',
  primaryDark: '#09090B', // Used for text on primary button
  accentCyan: '#38BDF8',
  accentCyanMuted: 'rgba(56, 189, 248, 0.1)',

  // High contrast text
  textPrimary: '#FAFAFA', // Zinc 50
  textSecondary: '#A1A1AA', // Zinc 400
  textMuted: '#8B8B94', // Lightened from Zinc 500 for AA contrast at small sizes
  textDark: '#09090B', // Used when text is ON a white primary background

  // Icons
  //
  // Settings/menu row glyphs are deliberately monochrome. Colour in this app
  // is reserved for meaning — money up or down (success/danger), a live
  // warning state (warning), a destructive action (danger), and the
  // selected/active state (primary). Tinting every row a different hue makes
  // a list read as decoration rather than information, so `icon` is the
  // default for any glyph that is only labelling its row.
  icon: '#A1A1AA', // tracks textSecondary
  iconActive: '#FAFAFA', // tracks textPrimary — selected / emphasised rows

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
  
  // Session-end wash (see components/SessionEndOverlay)
  //
  // Deep, desaturated grounds for the end-of-session transition. Flooding the
  // screen with the bright pastel danger/success would blow out the app's dark
  // world; these read unmistakably as red/green while staying Ante, and leave
  // enough contrast for the result figure to burn bright on top.
  washLoss: '#2A1114',
  washWin: '#0C2418',
  washNeutral: '#1C1C20',

  // Switches (see components/Toggle)
  //
  // The on state has to be legible without leaning on a hue, so the track
  // lightens instead of tinting. The knob stays white in both states, the way
  // a physical switch's does.
  switchTrackOff: '#27272A', // Zinc 800
  switchTrackOn: '#52525B', // Zinc 600 — clearly lighter than off

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
