/**
 * RescueDogs branded theme catalog (#17).
 * One palette — Trusted Care (orange / navy / white) — with light and dark modes.
 */

export const THEME_IDS = ['trusted-care-light', 'trusted-care-dark'] as const;

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
    label: 'Light',
    palette: 'Trusted Care',
  },
  {
    id: 'trusted-care-dark',
    label: 'Dark',
    palette: 'Trusted Care',
  },
];

/** Direct renames from pre-#17 RescueDogs / retired multi-palette ids. */
export const LEGACY_THEME_ALIASES: Record<string, ThemeId> = {
  'rescuedogs-light': 'trusted-care-light',
  'rescuedogs-dark': 'trusted-care-dark',
  'modern-connection-light': 'trusted-care-light',
  'modern-connection-dark': 'trusted-care-dark',
  'retro-friendly-light': 'trusted-care-light',
  'retro-friendly-dark': 'trusted-care-dark',
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
