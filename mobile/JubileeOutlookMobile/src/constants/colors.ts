/**
 * JubileeOutlook Mobile — Color palette
 * Matches the web frontend dark theme exactly.
 */
export const Colors = {
  // Primary brand
  primary: '#ffbd59',
  primaryDark: '#e6a94f',
  primaryLight: '#ffd080',

  // Accent (Microsoft Blue)
  accent: '#0078D4',
  accentDark: '#005A9E',
  accentLight: '#2B88D8',

  // Backgrounds
  background: '#000000',
  surface: '#1A1A1A',
  surfaceLight: '#2A2A2A',
  surfaceHover: '#333333',
  card: '#1E1E1E',
  elevated: '#252525',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textTertiary: '#808080',
  textDisabled: '#555555',
  textInverse: '#000000',

  // Semantic
  error: '#D13438',
  errorLight: '#E74856',
  success: '#107C10',
  successLight: '#13A10E',
  warning: '#FF8C00',
  warningLight: '#FFA940',
  info: '#0078D4',

  // Email states
  unread: '#FFFFFF',
  read: '#888888',
  flagged: '#D83B01',
  draft: '#ffbd59',

  // Borders & dividers
  border: '#333333',
  borderLight: '#444444',
  divider: '#2A2A2A',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.6)',
  scrim: 'rgba(0, 0, 0, 0.4)',

  // Auth-screen gold (matches web frontend's #FFD700 exactly)
  gold: '#FFD700',
  goldLight: '#FFDF40',
  goldDark: '#E5C100',
  goldDisabled: '#8B7500',
  inputBg: '#0D0D0D',

  // Transparent
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',

  // Folder icons
  folderInbox: '#0078D4',
  folderSent: '#107C10',
  folderDrafts: '#FF8C00',
  folderTrash: '#D13438',
  folderJunk: '#881798',
  folderArchive: '#767676',
  folderCustom: '#ffbd59',
} as const;

export type ColorKey = keyof typeof Colors;
