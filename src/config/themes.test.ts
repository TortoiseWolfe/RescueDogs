import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THEME_DARK,
  DEFAULT_THEME_LIGHT,
  normalizeThemeId,
} from './themes';

describe('normalizeThemeId', () => {
  it('returns default light for empty input', () => {
    expect(normalizeThemeId(null)).toBe(DEFAULT_THEME_LIGHT);
    expect(normalizeThemeId(undefined)).toBe(DEFAULT_THEME_LIGHT);
  });

  it('passes through known palette ids', () => {
    expect(normalizeThemeId('retro-friendly-dark')).toBe('retro-friendly-dark');
  });

  it('maps legacy rescuedogs ids to trusted care', () => {
    expect(normalizeThemeId('rescuedogs-light')).toBe('trusted-care-light');
    expect(normalizeThemeId('rescuedogs-dark')).toBe(DEFAULT_THEME_DARK);
  });

  it('maps removed stock dark themes to default dark', () => {
    expect(normalizeThemeId('dracula')).toBe(DEFAULT_THEME_DARK);
  });

  it('maps unknown light stock themes to default light', () => {
    expect(normalizeThemeId('cupcake')).toBe(DEFAULT_THEME_LIGHT);
  });
});
