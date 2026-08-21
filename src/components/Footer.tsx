'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SocialIcon from '@/components/atomic/SocialIcon';
import { projectConfig } from '@/config/project.config';
import { RAISED_PAWS_SOCIALS } from '@/config/raised-paws-socials';

/** Same white/navy pill chrome as the header — invert when pressed / current. */
const footerNavPill =
  'btn btn-sm border-0 bg-white text-[#1e3a8a] hover:bg-[#e8edf7] active:!bg-[#172554] active:!text-white';
const footerNavPillSelected =
  '!bg-[#172554] !text-white hover:!bg-[#1e3a8a] hover:!text-white active:!bg-[#172554] active:!text-white';

/** 44px AAA touch target at every width; the row wraps rather than shrinking. */
const footerSocialBtn =
  'btn btn-circle shrink-0 border-0 bg-white text-[#1e3a8a] hover:bg-[#e8edf7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white h-11 w-11 min-h-11 min-w-11';

const legalLinkClass =
  'link inline-flex min-h-11 items-center text-xs text-white underline sm:text-sm';

/**
 * Copyright year, fixed at build time by next.config.ts. Deliberately not
 * `new Date().getFullYear()`: this is a static export, so calling that here
 * bakes the build year into the prerendered HTML and then mismatches the
 * browser's year on hydration after Jan 1. The literal fallback keeps Vitest
 * and Storybook (which don't read next.config.ts) deterministic too.
 */
const COPYRIGHT_YEAR = process.env.NEXT_PUBLIC_BUILD_YEAR || '2026';

export function Footer() {
  const pathname = usePathname();
  const blogSelected = Boolean(pathname?.startsWith('/blog'));
  const followSelected = Boolean(pathname?.startsWith('/follow'));
  const contactSelected = Boolean(pathname?.startsWith('/contact'));
  const blogClass = `${footerNavPill} ${blogSelected ? footerNavPillSelected : ''}`;
  const followClass = `${footerNavPill} ${followSelected ? footerNavPillSelected : ''}`;
  const contactClass = `${footerNavPill} ${contactSelected ? footerNavPillSelected : ''}`;

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
      {/*
        Mobile: brand → socials → credit → pills → legal.
        md+: auto | 1fr | auto keeps side clusters on the outer edges;
        2-row grid keeps icons/pills on the logo row (not floating high
        as one tall side stack).
      */}
      <div className="mx-auto grid w-full grid-cols-1 items-center justify-items-center gap-3 px-2 sm:container sm:px-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:grid-rows-[auto_auto] md:gap-x-6 md:gap-y-1 md:px-4 lg:px-6">
        {/* Logo — center, row 1 */}
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center transition-opacity hover:opacity-90 md:col-start-2 md:row-start-1"
          aria-label="Raised Paws"
        >
          <Image
            src={`${projectConfig.basePath}/raised-paws-logo-white-paw.webp`}
            alt=""
            width={48}
            height={48}
            className="h-10 w-10 sm:h-11 sm:w-11"
          />
        </Link>

        {/* Tagline + © — center, row 2 */}
        <div className="flex flex-col items-center text-center md:col-start-2 md:row-start-2">
          <p className="font-friendly text-xs leading-relaxed font-bold sm:text-sm">
            Raised Paws · Every pet deserves a happy tail.
          </p>
          <p className="mt-1 text-xs text-white/90">
            © {COPYRIGHT_YEAR} Raised Paws
          </p>
        </div>

        {/* Socials — left edge, row 1; slight drop so sides sit with brand, not above it */}
        <ul
          className="m-0 flex list-none flex-wrap items-center justify-center gap-0.5 p-0 md:col-start-1 md:row-start-1 md:translate-y-3 md:gap-2"
          aria-label="Raised Paws on social media"
        >
          {RAISED_PAWS_SOCIALS.map((social) => (
            <li key={social.platform} className="shrink-0">
              <a
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Raised Paws on ${social.label}`}
                className={footerSocialBtn}
              >
                <SocialIcon platform={social.platform} className="h-5 w-5" />
              </a>
            </li>
          ))}
        </ul>

        {/* Built by — left edge, row 2; one line, centered under icons */}
        <p className="text-center text-xs whitespace-nowrap text-white/90 md:col-start-1 md:row-start-2 md:translate-y-3">
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
          </a>{' '}
          and{' '}
          <a
            href="https://scripthammer.com"
            target="_blank"
            rel="noopener noreferrer"
            className="link text-white underline"
          >
            ScriptHammer
          </a>
          .
        </p>

        {/* Pills — right edge, row 1 */}
        <nav
          className="flex flex-wrap items-center justify-center gap-1 md:col-start-3 md:row-start-1 md:translate-y-3"
          aria-label="Footer links"
        >
          <Link
            href="/blog"
            className={`${blogClass} inline-flex h-11 min-h-11 shrink-0 items-center px-2.5 text-xs sm:px-3 sm:text-sm`}
            aria-current={blogSelected ? 'page' : undefined}
          >
            Blog
          </Link>
          <Link
            href="/follow"
            className={`${followClass} inline-flex h-11 min-h-11 shrink-0 items-center px-2.5 text-xs sm:px-3 sm:text-sm`}
            aria-current={followSelected ? 'page' : undefined}
          >
            Follow
          </Link>
          <Link
            href="/contact"
            className={`${contactClass} inline-flex h-11 min-h-11 shrink-0 items-center px-2.5 text-xs sm:px-3 sm:text-sm`}
            aria-current={contactSelected ? 'page' : undefined}
          >
            Contact
          </Link>
        </nav>

        {/* Legal — right edge, row 2; centered under pills */}
        <nav
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 md:col-start-3 md:row-start-2 md:translate-y-3"
          aria-label="Legal"
        >
          <Link href="/privacy" className={legalLinkClass}>
            Privacy
          </Link>
          <Link href="/cookies" className={legalLinkClass}>
            Cookies
          </Link>
          <Link href="/terms" className={legalLinkClass}>
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
