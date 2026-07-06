/**
 * RescueDogs branded theme catalog (#17).
 * Three palettes × light/dark — replaces the full DaisyUI theme list in the nav.
 */

export const THEME_IDS = [
  'trusted-care-light',
  'trusted-care-dark',
  'modern-connection-light',
  'modern-connection-dark',
  'retro-friendly-light',
  'retro-friendly-dark',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME_LIGHT: ThemeId = 'trusted-care-light';
export const DEFAULT_THEME_DARK: ThemeId = 'trusted-care-dark';

/** Themes that use a dark color-scheme (for maps, embeds, Disqus). */
export const DARK_THEME_IDS: readonly ThemeId[] = THEME_IDS.filter((id) =>
  id.endsWith('-dark')
);

export type ThemeOption = {
  id: ThemeId;
  /** Short label for the theme dropdown */
  label: string;
  /** Palette group name */
  palette: string;
};

export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    id: 'trusted-care-light',
    label: 'Trusted Care — Light',
    palette: 'Trusted Care',
  },
  {
    id: 'trusted-care-dark',
    label: 'Trusted Care — Dark',
    palette: 'Trusted Care',
  },
  {
    id: 'modern-connection-light',
    label: 'Modern Connection — Light',
    palette: 'Modern Connection',
  },
  {
    id: 'modern-connection-dark',
    label: 'Modern Connection — Dark',
    palette: 'Modern Connection',
  },
  {
    id: 'retro-friendly-light',
    label: 'Retro Friendly — Light',
    palette: 'Retro Friendly',
  },
  {
    id: 'retro-friendly-dark',
    label: 'Retro Friendly — Dark',
    palette: 'Retro Friendly',
  },
];

/** Direct renames from pre-#17 RescueDogs / default DaisyUI ids. */
export const LEGACY_THEME_ALIASES: Record<string, ThemeId> = {
  'rescuedogs-light': 'trusted-care-light',
  'rescuedogs-dark': 'trusted-care-dark',
  light: 'trusted-care-light',
  dark: 'trusted-care-dark',
};

/** Stock DaisyUI dark themes → trusted-care dark when user had one saved. */
const LEGACY_DARK_FALLBACK = new Set([
  'synthwave',
  'halloween',
  'forest',
  'black',
  'luxury',
  'dracula',
  'business',
  'night',
  'coffee',
  'dim',
  'sunset',
]);

/** Serialized for ThemeScript inline bootstrap. */
export const THEME_SCRIPT_CONFIG = {
  themeIds: [...THEME_IDS],
  defaultLight: DEFAULT_THEME_LIGHT,
  defaultDark: DEFAULT_THEME_DARK,
  legacyAliases: LEGACY_THEME_ALIASES,
  legacyDark: [...LEGACY_DARK_FALLBACK],
} as const;

export function isKnownThemeId(theme: string): theme is ThemeId {
  return (THEME_IDS as readonly string[]).includes(theme);
}

/**
 * Map a stored or requested theme id to a supported RescueDogs palette theme.
 */
export function normalizeThemeId(theme: string | null | undefined): ThemeId {
  if (!theme) {
    return DEFAULT_THEME_LIGHT;
  }
  if (isKnownThemeId(theme)) {
    return theme;
  }
  const alias = LEGACY_THEME_ALIASES[theme];
  if (alias) {
    return alias;
  }
  if (LEGACY_DARK_FALLBACK.has(theme)) {
    return DEFAULT_THEME_DARK;
  }
  return DEFAULT_THEME_LIGHT;
}
