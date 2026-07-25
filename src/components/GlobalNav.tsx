'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatedLogo } from '@/components/atomic/AnimatedLogo';
import { projectConfig } from '@/config/project.config';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import AvatarDisplay from '@/components/atomic/AvatarDisplay';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { AdminAuthService } from '@/services/admin/admin-auth-service';
import { createClient } from '@/lib/supabase/client';
import { buildSignInHref } from '@/lib/portal/portal-preference';
import {
  DEFAULT_THEME_DARK,
  DEFAULT_THEME_LIGHT,
  normalizeThemeId,
} from '@/config/themes';

/** White chrome pills — invert to navy/white on press and when current (#65). */
const navChromeBtn =
  'btn btn-sm min-h-11 border-0 bg-white text-[#1e3a8a] hover:bg-[#e8edf7] active:!bg-[#172554] active:!text-white';
const navChromeBtnSelected =
  '!bg-[#172554] !text-white hover:!bg-[#1e3a8a] hover:!text-white active:!bg-[#172554] active:!text-white';
const navChromeIconBtn =
  'btn btn-circle min-h-11 min-w-11 border-0 bg-white text-[#1e3a8a] hover:bg-[#e8edf7] active:!bg-[#172554] active:!text-white';

/**
 * Navy that meets contrast on the orange header (#74 used #172554 after
 * #1e3a8a failed WCAG on primary). Used for role-dropdown “For” + hover/open.
 */
const NAV_NAVY = '#172554';

/** Bright white matching brand title readability on orange. */
const navBrightWhite = 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]';

const navDivider = 'mx-2 h-6 w-px shrink-0 bg-white/40';

const DEMO_ENTRY_HREF = '/get-started?demo=1&choose=1';
const BROWSE_DOGS_HREF = '/dogs';
const BROWSE_CATS_HREF = '/cats';

type NavLinkItem = { href: string; label: string };

const browseMenuLinks: NavLinkItem[] = [
  { href: BROWSE_DOGS_HREF, label: 'Dogs' },
  { href: BROWSE_CATS_HREF, label: 'Cats' },
];

const adopterMenuLinks: NavLinkItem[] = [
  { href: '/for-adopters', label: 'Overview' },
  { href: buildSignInHref('adopter'), label: 'Log In' },
  { href: DEMO_ENTRY_HREF, label: 'Try Demo' },
  { href: '/adopt', label: 'Apply to Adopt' },
  { href: '/applications', label: 'My Applications' },
];

const shelterMenuLinks: NavLinkItem[] = [
  { href: '/for-shelters', label: 'Overview' },
  { href: buildSignInHref('shelter'), label: 'Log In' },
  { href: DEMO_ENTRY_HREF, label: 'Try Demo' },
  { href: '/shelter', label: 'Shelter dashboard' },
  { href: '/blog', label: 'Blog' },
];

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className ?? 'ml-1 h-4 w-4'}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function blurActiveElement() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

/**
 * Resting split-label prefix on the orange header (“For”, “Browse”). Mid navy
 * (#172554) is only ~5.2:1 on #f97316 — fails WCAG AAA (7:1) in
 * color-contrast.spec. Near-black keeps the prefix darker than the white
 * accent word and passes AAA.
 */
const ROLE_FOR_REST = '#020617';

function RoleDropdown({
  prefixWord,
  accentWord,
  links,
}: {
  /** Dark prefix — “For” or “Browse” (#65 / #91). */
  prefixWord: string;
  /** White accent — “Adopters”, “Shelters”, or “Pets”. */
  accentWord: string;
  links: NavLinkItem[];
}) {
  const accessibleName = `${prefixWord} ${accentWord}`;
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const roleAccent = hovered || open;
  const forStyle = {
    color: roleAccent ? NAV_NAVY : ROLE_FOR_REST,
  } as const;
  const accentStyle = { color: NAV_NAVY } as const;

  return (
    <div
      className="dropdown"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        tabIndex={0}
        className="inline-flex min-h-11 items-center px-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={accessibleName}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="transition-colors" style={forStyle}>
          {prefixWord}&nbsp;
        </span>
        <span
          className={
            roleAccent
              ? 'transition-colors'
              : `${navBrightWhite} transition-colors`
          }
          style={roleAccent ? accentStyle : undefined}
        >
          {accentWord}
        </span>
        <span
          className={roleAccent ? undefined : navBrightWhite}
          style={roleAccent ? accentStyle : undefined}
        >
          <ChevronDown className="ml-1 h-3.5 w-3.5" />
        </span>
      </button>
      <ul
        tabIndex={0}
        role="menu"
        aria-label={accessibleName}
        className="menu dropdown-content bg-base-100 text-base-content rounded-box z-50 mt-3 w-56 p-2 text-sm font-medium shadow"
      >
        {links.map((item) => (
          <li key={`${accessibleName}-${item.href}-${item.label}`} role="none">
            <Link
              href={item.href}
              role="menuitem"
              className="min-h-11 text-sm font-medium"
              onClick={() => {
                setOpen(false);
                blurActiveElement();
              }}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GlobalNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile();
  const unreadCount = useUnreadCount();
  const [theme, setTheme] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setIsAdmin(false);
      return;
    }
    const supabase = createClient();
    const service = new AdminAuthService(supabase);
    service.checkIsAdmin(user.id).then(setIsAdmin);
  }, [user?.id]);

  // Theme management — read existing theme, don't overwrite ThemeScript's work.
  useEffect(() => {
    const savedTheme = normalizeThemeId(
      localStorage.getItem('theme') ||
        document.documentElement.getAttribute('data-theme') ||
        DEFAULT_THEME_DARK
    );
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    if (document.body) {
      document.body.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const handleThemeChange = (newTheme: string) => {
    const resolved = normalizeThemeId(newTheme);
    setTheme(resolved);
    localStorage.setItem('theme', resolved);
    document.documentElement.setAttribute('data-theme', resolved);

    if (document.body) {
      document.body.setAttribute('data-theme', resolved);
    }

    window.dispatchEvent(
      new CustomEvent('themechange', {
        detail: { theme: resolved },
      })
    );
  };

  const isDarkTheme = theme.endsWith('-dark');
  const handleThemeToggle = () => {
    handleThemeChange(isDarkTheme ? DEFAULT_THEME_LIGHT : DEFAULT_THEME_DARK);
  };

  const guestAdopterLinks = adopterMenuLinks;
  const guestShelterLinks = shelterMenuLinks;

  /** Signed-in menus omit Log In / Try Demo (account chrome covers auth). */
  const signedInAdopterLinks = adopterMenuLinks.filter(
    (item) => item.label !== 'Log In' && item.label !== 'Try Demo'
  );
  const signedInShelterLinks = shelterMenuLinks.filter(
    (item) => item.label !== 'Log In' && item.label !== 'Try Demo'
  );

  const desktopAdopterLinks = user ? signedInAdopterLinks : guestAdopterLinks;
  const desktopShelterLinks = user ? signedInShelterLinks : guestShelterLinks;
  const logInSelected = Boolean(pathname?.startsWith('/sign-in'));

  return (
    <header className="site-header bg-primary text-primary-content sticky top-0 z-50">
      <nav className="container mx-auto px-4" aria-label="Main">
        <div className="flex h-16 items-center justify-between gap-2">
          {/* Logo = home (left) */}
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="flex min-h-11 items-center gap-2 transition-opacity hover:opacity-80"
            >
              <Image
                src={`${projectConfig.basePath}/raised-paws-logo-64.webp`}
                alt="Raised Paws home"
                width={32}
                height={32}
                className="h-8 w-8 drop-shadow-sm"
                priority
              />
              <span className="hidden sm:block">
                <AnimatedLogo
                  text={projectConfig.projectDisplayName}
                  className="brand-logo !text-xl font-bold"
                  animationSpeed="normal"
                />
              </span>
            </Link>
          </div>

          {/* Right: role menus flush against pills */}
          <div className="flex flex-shrink-0 items-center gap-0.5 sm:gap-1 md:gap-2">
            <div className="hidden items-center gap-1 lg:flex">
              <RoleDropdown
                prefixWord="Browse"
                accentWord="Pets"
                links={browseMenuLinks}
              />
              <RoleDropdown
                prefixWord="For"
                accentWord="Adopters"
                links={desktopAdopterLinks}
              />
              <RoleDropdown
                prefixWord="For"
                accentWord="Shelters"
                links={desktopShelterLinks}
              />

              <span className={navDivider} aria-hidden="true" />

              {!user && (
                <Link
                  href="/sign-in"
                  className={`${navChromeBtn} inline-flex ${logInSelected ? navChromeBtnSelected : ''}`}
                  aria-current={logInSelected ? 'page' : undefined}
                >
                  Log In
                </Link>
              )}
            </div>

            {user && (
              <Link
                href="/messages"
                className={`${navChromeIconBtn} indicator`}
                title="Messages"
                aria-label="Messages"
              >
                {unreadCount > 0 && (
                  <span className="indicator-item badge badge-primary badge-sm">
                    {unreadCount}
                  </span>
                )}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </Link>
            )}

            {user ? (
              <div className="dropdown dropdown-end">
                <label
                  tabIndex={0}
                  className={navChromeIconBtn}
                  aria-label="User account menu"
                >
                  <AvatarDisplay
                    avatarUrl={
                      profile?.avatar_url ||
                      (user.user_metadata?.avatar_url as string) ||
                      null
                    }
                    displayName={profile?.display_name || user.email || 'User'}
                    size="sm"
                  />
                </label>
                <ul
                  tabIndex={0}
                  className="menu menu-sm dropdown-content bg-base-100 text-base-content rounded-box -right-2 z-50 mt-3 w-48 max-w-[calc(100vw-4rem)] p-2 shadow sm:w-52"
                >
                  <li className="menu-title">
                    <span>{user.email}</span>
                  </li>
                  <li>
                    <Link href="/profile">Profile</Link>
                  </li>
                  <li>
                    <Link href="/account">Account Settings</Link>
                  </li>
                  <li>
                    <Link
                      href="/messages"
                      className="flex items-center justify-between"
                    >
                      <span>Messages</span>
                      {unreadCount > 0 && (
                        <span className="badge badge-primary badge-sm">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                  </li>
                  <li>
                    <Link href="/messages?tab=connections">Connections</Link>
                  </li>
                  {isAdmin && (
                    <li>
                      <Link href="/admin">Admin Dashboard</Link>
                    </li>
                  )}
                  <li>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        blurActiveElement();
                        void signOut();
                      }}
                    >
                      Sign Out
                    </button>
                  </li>
                </ul>
              </div>
            ) : null}

            {/* Mobile/tablet menu — same destinations, nested by role (#65) */}
            <div className="dropdown dropdown-end lg:hidden">
              <label
                tabIndex={0}
                className={navChromeIconBtn}
                aria-label="Navigation menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </label>
              <ul
                tabIndex={0}
                className="menu dropdown-content bg-base-100 text-base-content rounded-box -right-2 z-50 mt-3 w-60 max-w-[calc(100vw-2rem)] p-2 text-base shadow"
              >
                <li className="menu-title">
                  <span>For Adopters</span>
                </li>
                {(user ? signedInAdopterLinks : guestAdopterLinks).map(
                  (item) => (
                    <li key={`m-adopter-${item.href}-${item.label}`}>
                      <Link
                        href={item.href}
                        className="min-h-11"
                        onClick={blurActiveElement}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                )}

                <li className="menu-title mt-2">
                  <span>For Shelters</span>
                </li>
                {(user ? signedInShelterLinks : guestShelterLinks).map(
                  (item) => (
                    <li key={`m-shelter-${item.href}-${item.label}`}>
                      <Link
                        href={item.href}
                        className="min-h-11"
                        onClick={blurActiveElement}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                )}

                <li className="menu-title mt-2">
                  <span>Browse Pets</span>
                </li>
                {browseMenuLinks.map((item) => (
                  <li key={`m-browse-${item.href}-${item.label}`}>
                    <Link
                      href={item.href}
                      className="min-h-11"
                      onClick={blurActiveElement}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}

                {user ? (
                  <>
                    <li className="menu-title mt-2">
                      <span>Account</span>
                    </li>
                    <li>
                      <Link href="/profile" className="min-h-11">
                        Profile
                      </Link>
                    </li>
                    <li>
                      <Link href="/account" className="min-h-11">
                        Settings
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/messages"
                        className="flex min-h-11 items-center justify-between"
                      >
                        <span>Messages</span>
                        {unreadCount > 0 && (
                          <span className="badge badge-primary badge-sm">
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/messages?tab=connections"
                        className="min-h-11"
                      >
                        Connections
                      </Link>
                    </li>
                    {isAdmin && (
                      <li>
                        <Link href="/admin" className="min-h-11">
                          Admin Dashboard
                        </Link>
                      </li>
                    )}
                    <li>
                      <button
                        type="button"
                        className="min-h-11"
                        onClick={(e) => {
                          e.preventDefault();
                          blurActiveElement();
                          void signOut();
                        }}
                      >
                        Sign Out
                      </button>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="menu-title mt-2">
                      <span>Account</span>
                    </li>
                    <li>
                      <Link
                        href={DEMO_ENTRY_HREF}
                        className="min-h-11"
                        onClick={blurActiveElement}
                      >
                        Try Demo
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/sign-in"
                        className="min-h-11"
                        onClick={blurActiveElement}
                      >
                        Log In
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </div>

            <button
              type="button"
              onClick={handleThemeToggle}
              className={navChromeIconBtn}
              title={
                isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'
              }
              aria-label={
                isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'
              }
            >
              {isDarkTheme ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}
