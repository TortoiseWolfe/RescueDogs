import React from 'react';
import type { Preview } from '@storybook/nextjs-vite';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import { ConsentProvider } from '../src/contexts/ConsentContext';
import '../src/app/globals.css';

// Initialize MSW
if (typeof window !== 'undefined') {
  import('../src/mocks/browser').then(({ worker }) => {
    // Start the mocking when in Storybook
    worker.start({
      onUnhandledRequest: 'bypass', // Don't warn about unhandled requests
    });
  });
}

const preview: Preview = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // Configure addon-a11y to use WCAG 2.1 AA standards
      config: {
        rules: [
          {
            // WCAG 2.1 AA rules
            id: 'wcag2aa',
            enabled: true,
          },
          {
            // Additional best practices
            id: 'best-practice',
            enabled: true,
          },
        ],
      },
      options: {
        runOnly: {
          type: 'tag',
          values: ['wcag2aa', 'best-practice'],
        },
      },
    },
  },
  decorators: [
    // Add ConsentProvider wrapper
    (Story) => (
      <ConsentProvider>
        <Story />
      </ConsentProvider>
    ),
    // DaisyUI themed background — ensures bg-base-100 is applied inside
    // the data-theme container so Docs page previews aren't plain white
    (Story) => (
      <div className="bg-base-100 text-base-content p-4">
        <Story />
      </div>
    ),
    // Theme decorator (outermost — sets data-theme on parent element)
    withThemeByDataAttribute({
      themes: {
        'trusted-care-light': 'trusted-care-light',
        'trusted-care-dark': 'trusted-care-dark',
      },
      defaultTheme: 'trusted-care-light',
      attributeName: 'data-theme',
    }),
  ],
};

export default preview;
