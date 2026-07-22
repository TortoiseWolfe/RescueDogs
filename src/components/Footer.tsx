import React from 'react';

export function Footer() {
  return (
    <footer className="mt-auto bg-[#1e3a8a] py-5 text-center text-white shadow-[0_-8px_24px_rgba(30,58,138,0.35)] sm:py-6">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <p className="font-friendly text-sm leading-relaxed font-bold">
          🐾 Raised Paws · Every pet deserves a happy tail.
        </p>
        <p className="mt-1 text-xs text-white/90">
          Built by{' '}
          <a
            href="https://www.techstackdevs.com"
            target="_blank"
            rel="noopener noreferrer"
            /* Persistent underline (not link-hover) so the link is
               distinguishable from surrounding footer text by more than color
               alone — satisfies axe's link-in-text-block (WCAG 1.4.1). */
            className="link text-white underline"
          >
            Tech Stack Devs
          </a>
          , powered by Supabase.
        </p>
      </div>
    </footer>
  );
}
