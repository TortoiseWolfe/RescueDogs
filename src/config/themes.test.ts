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
    expect(normalizeThemeId('trusted-care-dark')).toBe('trusted-care-dark');
    expect(normalizeThemeId('trusted-care-light')).toBe('trusted-care-light');
  });

  it('maps legacy rescuedogs ids to trusted care', () => {
    expect(normalizeThemeId('rescuedogs-light')).toBe('trusted-care-light');
    expect(normalizeThemeId('rescuedogs-dark')).toBe(DEFAULT_THEME_DARK);
  });

  it('maps retired multi-palette ids to trusted care', () => {
    expect(normalizeThemeId('modern-connection-light')).toBe(
      'trusted-care-light'
    );
    expect(normalizeThemeId('modern-connection-dark')).toBe(DEFAULT_THEME_DARK);
    expect(normalizeThemeId('retro-friendly-light')).toBe('trusted-care-light');
    expect(normalizeThemeId('retro-friendly-dark')).toBe(DEFAULT_THEME_DARK);
  });

  it('maps removed stock dark themes to default dark', () => {
    expect(normalizeThemeId('dracula')).toBe(DEFAULT_THEME_DARK);
  });

  it('maps unknown light stock themes to default light', () => {
    expect(normalizeThemeId('cupcake')).toBe(DEFAULT_THEME_LIGHT);
  });
});
