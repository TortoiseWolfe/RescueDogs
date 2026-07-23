'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Same white/navy pill chrome as the header — invert when pressed / current. */
const footerBlogPill =
  'btn btn-sm min-h-11 border-0 bg-white text-[#1e3a8a] hover:bg-[#e8edf7] active:!bg-[#172554] active:!text-white';
const footerBlogPillSelected =
  '!bg-[#172554] !text-white hover:!bg-[#1e3a8a] hover:!text-white active:!bg-[#172554] active:!text-white';

export function Footer() {
  const pathname = usePathname();
  const blogSelected = Boolean(pathname?.startsWith('/blog'));
  const blogClass = `${footerBlogPill} ${blogSelected ? footerBlogPillSelected : ''}`;

  // Full-viewport messaging UIs — site footer overlaps conversation list on
  // short mobile viewports and intercepts clicks (E2E messaging-scroll T003).
  const hideOnMessaging =
    Boolean(pathname?.startsWith('/messages')) ||
    Boolean(pathname?.startsWith('/conversations'));

  if (hideOnMessaging) {
    return null;
  }

  return (
    <footer className="mt-auto bg-[#1e3a8a] py-5 text-white shadow-[0_-8px_24px_rgba(30,58,138,0.35)] sm:py-6">
      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Primary copy stays centered; Blog pill sits to the side without shifting it. */}
        <div className="text-center">
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
        <Link
          href="/blog"
          className={`${blogClass} absolute top-1/2 right-4 hidden -translate-y-1/2 sm:right-6 sm:inline-flex lg:right-8`}
          aria-current={blogSelected ? 'page' : undefined}
        >
          Blog
        </Link>
        {/* Mobile: keep Blog reachable without breaking centered layout */}
        <p className="mt-3 text-center sm:hidden">
          <Link
            href="/blog"
            className={`${blogClass} inline-flex`}
            aria-current={blogSelected ? 'page' : undefined}
          >
            Blog
          </Link>
        </p>
      </div>
    </footer>
  );
}
