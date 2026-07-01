import React from 'react';

export function Footer() {
  return (
    <footer className="mt-auto bg-[#27408f] py-5 text-center text-[#dbe6ff] shadow-[0_-8px_24px_rgba(39,64,143,0.25)] sm:py-6">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <p className="font-friendly text-sm leading-relaxed font-bold">
          🐾 RescueDogs · Every pet deserves a happy tail.
        </p>
        <p className="mt-1 text-xs text-[#dbe6fb]">
          Built by{' '}
          <a
            href="https://github.com/TortoiseWolfe/RescueDogs"
            target="_blank"
            rel="noopener noreferrer"
            /* Persistent underline (not link-hover) so the link is
               distinguishable from surrounding footer text by more than color
               alone — satisfies axe's link-in-text-block (WCAG 1.4.1). */
            className="link text-[#ffdd6b] underline"
          >
            RescueDogs
          </a>
          , powered by Supabase.
        </p>
      </div>
    </footer>
  );
}
