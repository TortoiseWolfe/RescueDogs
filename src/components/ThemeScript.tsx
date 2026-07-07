import { THEME_SCRIPT_CONFIG } from '@/config/themes';

export default function ThemeScript() {
  const cfg = JSON.stringify(THEME_SCRIPT_CONFIG);

  const themeScript = `
    (function() {
      var CFG = ${cfg};

      function normalizeTheme(theme) {
        if (!theme) return CFG.defaultLight;
        if (CFG.themeIds.indexOf(theme) !== -1) return theme;
        if (CFG.legacyAliases[theme]) return CFG.legacyAliases[theme];
        if (CFG.legacyDark.indexOf(theme) !== -1) return CFG.defaultDark;
        return CFG.defaultLight;
      }

      function getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          return CFG.defaultDark;
        }
        return CFG.defaultLight;
      }

      function applyTheme(rawTheme) {
        var theme = rawTheme;
        if (!theme) {
          try {
            theme = localStorage.getItem('theme');
            if (!theme) {
              theme = getSystemTheme();
            }
          } catch (e) {
            theme = getSystemTheme();
          }
        }

        theme = normalizeTheme(theme);
        document.documentElement.setAttribute('data-theme', theme);
        if (document.body) {
          document.body.setAttribute('data-theme', theme);
        }

        return theme;
      }

      var currentTheme = applyTheme();

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          applyTheme(currentTheme);
        });
      }

      window.addEventListener('storage', function(e) {
        if (e.key === 'theme' && e.newValue) {
          currentTheme = normalizeTheme(e.newValue);
          applyTheme(currentTheme);
        }
      });

      window.addEventListener('themechange', function(e) {
        if (e.detail && e.detail.theme) {
          currentTheme = normalizeTheme(e.detail.theme);
          applyTheme(currentTheme);
        }
      });

      if (!document.body) {
        var observer = new MutationObserver(function() {
          if (document.body) {
            applyTheme(currentTheme);
            observer.disconnect();
          }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
      }

      if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
          if (!localStorage.getItem('theme')) {
            currentTheme = getSystemTheme();
            applyTheme(currentTheme);
          }
        });
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
