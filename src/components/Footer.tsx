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
      {/* Phones use the full viewport: `container` caps at the xs breakpoint
          (320px), which cannot hold six 44px socials plus the Blog pill. */}
      <div className="relative mx-auto w-full px-2 sm:container sm:px-6 lg:px-8">
        {/* Copy stays truly centered; chrome is out of flow on sm+ (#118). */}
        <div className="text-center">
          <Link
            href="/"
            className="mb-2 inline-flex min-h-11 items-center justify-center transition-opacity hover:opacity-90"
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
          <p className="font-friendly text-sm leading-relaxed font-bold">
            Raised Paws · Every pet deserves a happy tail.
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

        {/* Mobile: centered row (socials + Blog + Contact), wrap OK. sm+:
            socials left, Blog+Contact right (#128). */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1 sm:mt-0 sm:contents">
          <ul
            className="m-0 flex list-none flex-wrap items-center justify-center gap-0.5 p-0 sm:absolute sm:top-1/2 sm:left-6 sm:max-w-[42%] sm:-translate-y-1/2 sm:gap-2 lg:left-8"
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
          <nav
            className="flex flex-wrap items-center justify-center gap-1 sm:absolute sm:top-1/2 sm:right-6 sm:-translate-y-1/2 lg:right-8"
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
        </div>
      </div>
    </footer>
  );
}
