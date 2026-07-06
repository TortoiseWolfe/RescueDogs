'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { canUseCookies } from '../../utils/consent';
import { CookieCategory } from '../../utils/consent-types';
import { useAnalytics } from '@/hooks/useAnalytics';
import {
  DEFAULT_THEME_DARK,
  normalizeThemeId,
  THEME_OPTIONS,
  type ThemeId,
} from '@/config/themes';

export function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(DEFAULT_THEME_DARK);
  const { trackThemeChange } = useAnalytics();

  useEffect(() => {
    const canPersist = canUseCookies(CookieCategory.FUNCTIONAL);
    let savedTheme: string = DEFAULT_THEME_DARK;

    if (canPersist) {
      savedTheme =
        localStorage.getItem('theme') ||
        document.documentElement.getAttribute('data-theme') ||
        DEFAULT_THEME_DARK;
    } else {
      savedTheme =
        sessionStorage.getItem('theme') ||
        document.documentElement.getAttribute('data-theme') ||
        DEFAULT_THEME_DARK;
    }

    const resolved = normalizeThemeId(savedTheme);
    setCurrentTheme(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  }, []);

  const handleThemeChange = useCallback(
    (theme: string) => {
      const resolved = normalizeThemeId(theme);
      const previousTheme = currentTheme;
      setCurrentTheme(resolved);

      trackThemeChange(resolved, previousTheme);

      document.documentElement.setAttribute('data-theme', resolved);
      document.body?.setAttribute('data-theme', resolved);

      const canPersist = canUseCookies(CookieCategory.FUNCTIONAL);

      if (canPersist) {
        localStorage.setItem('theme', resolved);
        sessionStorage.setItem('theme', resolved);

        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'theme',
            newValue: resolved,
            url: window.location.href,
            storageArea: localStorage,
          })
        );
      } else {
        sessionStorage.setItem('theme', resolved);
      }

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'THEME_CHANGE',
          theme: resolved,
        });
      }
    },
    [currentTheme, trackThemeChange]
  );

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Theme Selector</h2>
        <p className="text-base-content/95 text-sm">
          Three rescue brand palettes, each with light and dark modes
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {THEME_OPTIONS.map((theme) => (
            <button
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              className={`btn btn-sm ${
                currentTheme === theme.id ? 'btn-primary' : 'btn-ghost'
              }`}
              data-theme={theme.id}
            >
              {theme.label}
            </button>
          ))}
        </div>

        <div className="divider">Preview</div>

        <div className="flex flex-wrap gap-2">
          <div className="badge badge-primary">Primary</div>
          <div className="badge badge-secondary">Secondary</div>
          <div className="badge badge-accent">Accent</div>
          <div className="badge badge-neutral">Neutral</div>
          <div className="badge badge-info">Info</div>
          <div className="badge badge-success">Success</div>
          <div className="badge badge-warning">Warning</div>
          <div className="badge badge-error">Error</div>
        </div>

        <div className="mt-4">
          <button className="btn btn-primary">Primary Button</button>
          <button className="btn btn-secondary ml-2">Secondary</button>
        </div>
      </div>
    </div>
  );
}

export default ThemeSwitcher;
