'use client';

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
import {
  buildSignInHref,
  getPortalPreference,
  type PortalType,
} from '@/lib/portal/portal-preference';
import {
  clearDemoMode,
  enterDemoMode,
  getDemoModePortal,
  isDemoMode,
  oppositePortal,
  restartDemoTour,
  switchDemoRoleHref,
} from '@/lib/demo/demo-session';
import {
  DEFAULT_THEME_DARK,
  DEFAULT_THEME_LIGHT,
  normalizeThemeId,
} from '@/config/themes';

/** White chrome pills — invert to navy/white on press and when current (#65). */
const navChromeBtn =
  'btn btn-sm header-wedge-btn min-h-11 border-0 bg-white text-[#1e3a8a] hover:bg-[#e8edf7] active:!bg-[#172554] active:!text-white';
const navChromeBtnSelected =
  '!bg-[#172554] !text-white hover:!bg-[#1e3a8a] hover:!text-white active:!bg-[#172554] active:!text-white';
const navChromeIconBtn =
  'btn btn-circle header-wedge-btn min-h-11 min-w-11 border-0 bg-white text-[#1e3a8a] hover:bg-[#e8edf7] active:!bg-[#172554] active:!text-white';
/** Only when brand+chrome would collide (e.g. S9+ ~360px, Lumia ~320px) (#132). */
const navChromeIconBtnCompact = 'min-h-10 min-w-10 h-10 w-10';

/**
 * Role-menu colors on the white desktop strip (#79 / #115).
 * Prefix (Browse/For) = orange; accent (Pets/Adopters/Shelters) = navy →
 * orange on hover/open. Accent orange must be ≥7:1 on white (WCAG AAA) —
 * #c2410c was 5.17:1, so we keep #9a3412.
 */
const NAV_NAVY = '#1e3a8a';
const NAV_ACCENT = '#9a3412';

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
 * Split-label role menus on the white strip (#79 / #115):
 * orange prefix (Browse/For) + navy accent → orange on hover/open.
 */
function RoleDropdown({
  prefixWord,
  accentWord,
  links,
}: {
  /** Prefix — “For” or “Browse” (#65 / #91). */
  prefixWord: string;
  /** Accent — “Adopters”, “Shelters”, or “Pets”. */
  accentWord: string;
  links: NavLinkItem[];
}) {
  const accessibleName = `${prefixWord} ${accentWord}`;
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const roleAccent = hovered || open;
  const prefixStyle = {
    color: NAV_ACCENT,
  } as const;
  const accentStyle = {
    color: roleAccent ? NAV_ACCENT : NAV_NAVY,
  } as const;

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
        className="inline-flex min-h-11 items-center px-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e3a8a]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={accessibleName}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="transition-colors" style={prefixStyle}>
          {prefixWord}&nbsp;
        </span>
        <span className="transition-colors" style={accentStyle}>
          {accentWord}
        </span>
        <span className="transition-colors" style={accentStyle}>
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
  const [demoSession, setDemoSession] = useState(false);
  const [messagesSignInOpen, setMessagesSignInOpen] = useState(false);
  /** Shrink chrome only when wordmark + icons would collide (#132). */
  const [chromeCompact, setChromeCompact] = useState(false);
  const navRowRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDemoSession(isDemoMode());
  }, [user?.id, pathname]);

  // Measure brand vs row — compact only on phones where S9+/Lumia-class widths
  // collide (~320–360px). Wider phones keep full 44px targets (#132).
  useLayoutEffect(() => {
    const row = navRowRef.current;
    const brand = brandRef.current;
    if (!row || !brand) return;

    const measure = () => {
      if (typeof window === 'undefined') return;
      if (window.matchMedia('(min-width: 1024px)').matches) {
        setChromeCompact(false);
        return;
      }
      // Guest: Messages + hamburger + theme. Signed-in adds avatar.
      const iconCount = user ? 4 : 3;
      const fullIcon = 44;
      const gap = 4;
      const fullChrome = fullIcon * iconCount + gap * (iconCount - 1);
      const padding = 12;
      const needed = brand.scrollWidth + fullChrome + padding;
      setChromeCompact(needed > row.clientWidth);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    ro.observe(brand);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [user]);

  const chromeIconClass = chromeCompact
    ? `${navChromeIconBtn} ${navChromeIconBtnCompact}`
    : navChromeIconBtn;
  const themeDarkClass = chromeCompact
    ? 'btn btn-circle min-h-10 min-w-10 h-10 w-10 border-0 !bg-[#1e3a8a] !text-white hover:!bg-[#172554] hover:!text-white active:!bg-[#172554] active:!text-white'
    : 'btn btn-circle min-h-11 min-w-11 border-0 !bg-[#1e3a8a] !text-white hover:!bg-[#172554] hover:!text-white active:!bg-[#172554] active:!text-white';

  const messagesSignInHref = buildSignInHref(
    getPortalPreference() ?? 'adopter'
  );

  const messagesIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  );

  const resolveDemoPortal = (): PortalType => {
    const fromDemo = getDemoModePortal();
    if (fromDemo) return fromDemo;
    const preferred = getPortalPreference();
    if (preferred) return preferred;
    if (pathname?.startsWith('/shelter')) return 'shelter';
    return 'adopter';
  };

  const handleSwitchDemoRole = async () => {
    const current = resolveDemoPortal();
    const next = oppositePortal(current);
    const href = switchDemoRoleHref(current);
    blurActiveElement();
    // Keep demo mode across hard redirect; signOut clears portal preference
    // but the destination URL carries portal= + demo=1 + switch=1.
    enterDemoMode(next);
    await signOut({ redirectTo: href });
  };

  const handleRestartDemoTour = () => {
    blurActiveElement();
    restartDemoTour();
    setDemoSession(true);
  };

  const handleSignOut = () => {
    blurActiveElement();
    clearDemoMode();
    setDemoSession(false);
    void signOut();
  };

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
    <>
      <header className="site-header bg-primary text-primary-content sticky top-0 z-50">
        {/* Below lg: logo + Raised Paws left; Messages / hamburger / theme right.
            No chrome Log In (hamburger Account). lg+: role band unchanged (#132). */}
        <nav
          className="mx-auto w-full px-2 max-lg:pr-1 lg:container lg:px-4 lg:pr-3"
          aria-label="Main"
        >
          <div
            ref={navRowRef}
            className="flex h-16 w-full items-center gap-1.5 sm:gap-2"
            data-chrome-compact={chromeCompact ? 'true' : 'false'}
          >
            {/* Logo + wordmark — always in header (#132). */}
            <div
              ref={brandRef}
              className="flex min-w-0 shrink items-center gap-2 sm:gap-3"
            >
              <Link
                href="/"
                className="flex min-h-11 min-w-0 items-center gap-1.5 transition-opacity hover:opacity-80 sm:gap-2"
              >
                <Image
                  src={`${projectConfig.basePath}/raised-paws-logo-white-paw.webp`}
                  alt="Raised Paws home"
                  width={44}
                  height={44}
                  className={
                    chromeCompact
                      ? 'h-9 w-9 shrink-0 drop-shadow-[0_1px_2px_rgba(23,37,84,0.45)]'
                      : 'h-10 w-10 shrink-0 drop-shadow-[0_1px_2px_rgba(23,37,84,0.45)] sm:h-11 sm:w-11'
                  }
                  priority
                />
                <span className="min-w-0">
                  <AnimatedLogo
                    text={projectConfig.projectDisplayName}
                    className={
                      chromeCompact
                        ? 'brand-logo !text-base font-bold'
                        : 'brand-logo !text-lg font-bold sm:!text-xl'
                    }
                    animationSpeed="normal"
                  />
                </span>
              </Link>
            </div>

            {/* White role band — desktop only (#79 / #127). */}
            <div
              className="hidden min-w-0 flex-1 self-stretch lg:block"
              aria-hidden="true"
            />
            <div className="hidden self-stretch lg:flex lg:items-center lg:pr-3">
              {/* White role band wedged into orange (#142) — decorative
                  clip-path on ::before so dropdown panels are not clipped. */}
              <div className="header-wedge my-2.5 flex min-h-11 items-center gap-0.5 px-4 py-0.5">
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
              </div>
            </div>

            {/* Orange chrome — flush right; hamburger left of theme (#132). */}
            <div className="ml-auto flex h-full shrink-0 items-center justify-end gap-1 sm:gap-1.5 lg:gap-2.5 lg:pr-2 lg:pl-6">
              {user ? (
                <Link
                  href="/messages"
                  className={`${chromeIconClass} indicator`}
                  title="Messages"
                  aria-label="Messages"
                >
                  {unreadCount > 0 && (
                    <span className="indicator-item badge badge-primary badge-sm">
                      {unreadCount}
                    </span>
                  )}
                  {messagesIcon}
                </Link>
              ) : (
                <button
                  type="button"
                  className={chromeIconClass}
                  title="Messages"
                  aria-label="Messages"
                  aria-haspopup="dialog"
                  onClick={() => setMessagesSignInOpen(true)}
                >
                  {messagesIcon}
                </button>
              )}

              {!user && (
                <Link
                  href="/sign-in"
                  className={`${navChromeBtn} hidden lg:inline-flex ${logInSelected ? navChromeBtnSelected : ''}`}
                  aria-current={logInSelected ? 'page' : undefined}
                >
                  Log In
                </Link>
              )}

              {user ? (
                <div className="dropdown dropdown-end">
                  <label
                    tabIndex={0}
                    className={chromeIconClass}
                    aria-label="User account menu"
                  >
                    <AvatarDisplay
                      avatarUrl={
                        profile?.avatar_url ||
                        (user.user_metadata?.avatar_url as string) ||
                        null
                      }
                      displayName={
                        profile?.display_name || user.email || 'User'
                      }
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
                    {demoSession && (
                      <>
                        <li>
                          <button
                            type="button"
                            data-testid="switch-demo-role"
                            onClick={(e) => {
                              e.preventDefault();
                              void handleSwitchDemoRole();
                            }}
                          >
                            Switch to{' '}
                            {oppositePortal(resolveDemoPortal()) === 'shelter'
                              ? 'shelter'
                              : 'adopter'}{' '}
                            demo
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            data-testid="restart-demo-tour"
                            onClick={(e) => {
                              e.preventDefault();
                              handleRestartDemoTour();
                            }}
                          >
                            Restart demo tour
                          </button>
                        </li>
                      </>
                    )}
                    <li>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleSignOut();
                        }}
                      >
                        Sign Out
                      </button>
                    </li>
                  </ul>
                </div>
              ) : null}

              {/* Mobile/tablet menu — one column + scroll. Titles orange, items
                  navy (#132). Hamburger left of theme so panel isn’t clipped. */}
              <div className="dropdown dropdown-end lg:hidden">
                <label
                  tabIndex={0}
                  className={chromeIconClass}
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
                <div
                  tabIndex={0}
                  className="dropdown-content bg-base-100 text-base-content rounded-box z-50 mt-3 max-h-[min(60vh,calc(100vh-5rem))] w-60 max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain shadow"
                >
                  <ul className="menu menu-vertical w-full p-2 text-base">
                    <li className="menu-title">
                      <span className="!text-[#f97316]">For Adopters</span>
                    </li>
                    {(user ? signedInAdopterLinks : guestAdopterLinks).map(
                      (item) => (
                        <li key={`m-adopter-${item.href}-${item.label}`}>
                          <Link
                            href={item.href}
                            className="min-h-11 !text-[#1e3a8a]"
                            onClick={blurActiveElement}
                          >
                            {item.label}
                          </Link>
                        </li>
                      )
                    )}
                    <li className="menu-title mt-2">
                      <span className="!text-[#f97316]">For Shelters</span>
                    </li>
                    {(user ? signedInShelterLinks : guestShelterLinks).map(
                      (item) => (
                        <li key={`m-shelter-${item.href}-${item.label}`}>
                          <Link
                            href={item.href}
                            className="min-h-11 !text-[#1e3a8a]"
                            onClick={blurActiveElement}
                          >
                            {item.label}
                          </Link>
                        </li>
                      )
                    )}
                    {user ? (
                      <>
                        <li className="menu-title mt-2">
                          <span className="!text-[#f97316]">Account</span>
                        </li>
                        <li>
                          <Link
                            href="/profile"
                            className="min-h-11 !text-[#1e3a8a]"
                            onClick={blurActiveElement}
                          >
                            Profile
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/account"
                            className="min-h-11 !text-[#1e3a8a]"
                            onClick={blurActiveElement}
                          >
                            Account Settings
                          </Link>
                        </li>
                        {isAdmin && (
                          <li>
                            <Link
                              href="/admin"
                              className="min-h-11 !text-[#1e3a8a]"
                              onClick={blurActiveElement}
                            >
                              Admin Dashboard
                            </Link>
                          </li>
                        )}
                        {demoSession && (
                          <>
                            <li>
                              <button
                                type="button"
                                className="min-h-11 !text-[#1e3a8a]"
                                data-testid="switch-demo-role-mobile"
                                onClick={(e) => {
                                  e.preventDefault();
                                  blurActiveElement();
                                  void handleSwitchDemoRole();
                                }}
                              >
                                Switch to{' '}
                                {oppositePortal(resolveDemoPortal()) ===
                                'shelter'
                                  ? 'shelter'
                                  : 'adopter'}{' '}
                                demo
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                className="min-h-11 !text-[#1e3a8a]"
                                data-testid="restart-demo-tour-mobile"
                                onClick={(e) => {
                                  e.preventDefault();
                                  blurActiveElement();
                                  handleRestartDemoTour();
                                }}
                              >
                                Restart demo tour
                              </button>
                            </li>
                          </>
                        )}
                        <li>
                          <button
                            type="button"
                            className="min-h-11 !text-[#1e3a8a]"
                            onClick={(e) => {
                              e.preventDefault();
                              blurActiveElement();
                              handleSignOut();
                            }}
                          >
                            Sign Out
                          </button>
                        </li>
                      </>
                    ) : (
                      <>
                        <li className="menu-title mt-2">
                          <span className="!text-[#f97316]">Account</span>
                        </li>
                        <li>
                          <Link
                            href={DEMO_ENTRY_HREF}
                            className="min-h-11 !text-[#1e3a8a]"
                            onClick={blurActiveElement}
                          >
                            Try Demo
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/sign-in"
                            className="min-h-11 !text-[#1e3a8a]"
                            onClick={blurActiveElement}
                          >
                            Log In
                          </Link>
                        </li>
                      </>
                    )}
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={handleThemeToggle}
                className={isDarkTheme ? themeDarkClass : chromeIconClass}
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

      {messagesSignInOpen && (
        <dialog
          className="modal modal-open"
          open
          aria-labelledby="messages-signin-title"
          aria-describedby="messages-signin-desc"
        >
          <div className="modal-box bg-base-100 text-base-content">
            <h2 id="messages-signin-title" className="text-lg font-bold">
              Log in first to message.
            </h2>
            <p id="messages-signin-desc" className="py-3 text-sm opacity-80">
              Sign in to open Messages and chat with shelters or adopters.
            </p>
            <div className="modal-action flex flex-wrap gap-2">
              <Link
                href={messagesSignInHref}
                className="btn btn-primary min-h-11"
                onClick={() => setMessagesSignInOpen(false)}
              >
                Log In
              </Link>
              <button
                type="button"
                className="btn btn-ghost min-h-11"
                onClick={() => setMessagesSignInOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setMessagesSignInOpen(false)}
            >
              close
            </button>
          </form>
        </dialog>
      )}
    </>
  );
}
