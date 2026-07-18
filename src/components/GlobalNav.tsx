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
import { ShelterApplicationService } from '@/services/applications';
import { createClient } from '@/lib/supabase/client';
import {
  DEFAULT_THEME_DARK,
  DEFAULT_THEME_LIGHT,
  normalizeThemeId,
} from '@/config/themes';

/** Navy chrome buttons on the orange site header (#53). */
const navChromeBtn =
  'btn btn-sm min-h-11 border-0 bg-[#1e3a8a] text-white hover:bg-[#172554]';
const navChromeIconBtn =
  'btn btn-circle min-h-11 min-w-11 border-0 bg-[#1e3a8a] text-white hover:bg-[#172554]';

export function GlobalNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile();
  const unreadCount = useUnreadCount();
  const [theme, setTheme] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isShelterStaff, setIsShelterStaff] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setIsAdmin(false);
      return;
    }
    const supabase = createClient();
    const service = new AdminAuthService(supabase);
    service.checkIsAdmin(user.id).then(setIsAdmin);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setIsShelterStaff(false);
      return;
    }
    const supabase = createClient();
    const service = new ShelterApplicationService(supabase);
    service
      .getMyShelterMembership(user.id)
      .then((membership) => setIsShelterStaff(membership !== null));
  }, [user?.id]);

  // Theme management — read existing theme, don't overwrite ThemeScript's work.
  // ThemeScript runs before hydration and sets data-theme from localStorage
  // or system preference; we just sync React state to it here.
  useEffect(() => {
    const savedTheme = normalizeThemeId(
      localStorage.getItem('theme') ||
        document.documentElement.getAttribute('data-theme') ||
        DEFAULT_THEME_DARK
    );
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Also set on body for consistency
    if (document.body) {
      document.body.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const handleThemeChange = (newTheme: string) => {
    const resolved = normalizeThemeId(newTheme);
    setTheme(resolved);
    localStorage.setItem('theme', resolved);
    document.documentElement.setAttribute('data-theme', resolved);

    // Also set on body for consistency
    if (document.body) {
      document.body.setAttribute('data-theme', resolved);
    }

    // Dispatch custom event for other components to listen to
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

  const navItems = [
    { href: '/', label: 'Home' },
    ...(!user
      ? [
          { href: '/for-adopters', label: 'For Adopters' },
          { href: '/for-shelters', label: 'For Shelters' },
          { href: '/#meet-pets-heading', label: 'Browse Pets' },
        ]
      : [{ href: '/adopt', label: 'Apply To Adopt' }]),
    ...(user ? [{ href: '/applications', label: 'My Applications' }] : []),
    ...(isShelterStaff ? [{ href: '/shelter', label: 'Shelter' }] : []),
    { href: '/blog', label: 'Blog' },
    // { href: '/docs', label: 'Docs' },
  ];

  return (
    <header className="site-header bg-primary text-primary-content sticky top-0 z-50">
      <nav className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex min-h-11 items-center gap-2 transition-opacity hover:opacity-80"
            >
              <Image
                src={`${projectConfig.basePath}/raised-paws-logo.png`}
                alt="Raised Paws"
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

          {/* Main Navigation */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (pathname?.startsWith(item.href + '/') && item.href !== '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`${navChromeBtn} ${isActive ? 'bg-[#172554] ring-2 ring-white/40' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Section: Auth, Theme & PWA - Mobile-first spacing (PRP-017 T025) */}
          {/* Use flex-shrink-0 to prevent items from shrinking, overflow-hidden to prevent horizontal scroll */}
          <div className="flex flex-shrink-0 items-center gap-0.5 sm:gap-1 md:gap-2">
            {/* Messages Icon (authenticated users only) */}
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

            {/* Auth Buttons */}
            {/* User account dropdown (logged in) or auth buttons (logged out) */}
            {/* Auth buttons hidden on mobile - they're in the hamburger menu */}
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
                        // Close dropdown
                        if (document.activeElement instanceof HTMLElement) {
                          document.activeElement.blur();
                        }
                        // signOut() handles the window.location.href='/'
                        // redirect internally; setting it again here races
                        // with the in-flight navigation on Firefox and
                        // manifests as NS_BINDING_ABORTED in Playwright's
                        // page.waitForURL.
                        void signOut();
                      }}
                    >
                      Sign Out
                    </button>
                  </li>
                </ul>
              </div>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className={`${navChromeBtn} hidden lg:inline-flex`}
                >
                  Log In
                </Link>
              </>
            )}

            {/* Mobile/tablet menu (visible below lg) - 44px touch target */}
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
                className="menu menu-sm dropdown-content bg-base-100 text-base-content rounded-box -right-2 z-50 mt-3 w-40 max-w-[calc(100vw-4rem)] p-2 shadow sm:w-44"
              >
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={pathname === item.href ? 'active' : ''}
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
                      <Link href="/profile">Profile</Link>
                    </li>
                    <li>
                      <Link href="/account">Settings</Link>
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
                          // Close dropdown
                          if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                          }
                          // signOut() handles the redirect internally.
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
                      <Link href="/sign-in">Log In</Link>
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* Light / dark toggle — shows current mode (moon = dark, sun = light) */}
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
