/**
 * What a bug report carries besides the words, and what it deliberately does not.
 *
 * NOTHING IDENTIFYING TRAVELS. Platform, app build, locale, timezone and the route they
 * were on. Not a name, not an email, not another person's data, and NOT A USER AGENT --
 * that string is a fingerprint, and a report is not a place to collect one.
 *
 * THE SHEET PRINTS THIS BEFORE SENDING (`factLine`), which is the whole contract: a report
 * that quietly harvests is a different product from one that says what it collects. Any
 * field added to `factsFrom` must also appear in `factLine`, or that promise quietly stops
 * being true.
 *
 * `factsFrom` IS PURE AND `deviceFacts` IS THE WIRING, and that split is deliberate.
 * Upstream this file was rewritten because it read the build number out of config, where it
 * was absent, so every report said "build unknown" -- and six unit tests over the pure
 * function all passed, because the pure function was never wrong. The tests that matter
 * here are the ones that exercise the READER.
 *
 * @module lib/feedback/device-facts
 */

import pkg from '../../../package.json';

export interface DeviceFacts {
  platform: string;
  app?: string;
  build?: string;
  locale?: string;
  timezone?: string;
  route?: string;
}

export interface FactsEnv {
  buildSha?: string;
  version?: string;
  locale?: string;
  timezone?: string;
  route?: string;
}

/**
 * OMIT RATHER THAN STRINGIFY. A missing value left in becomes the literal "undefined" in a
 * JSON column and then in an issue body, where it reads as a fact about the reporter's
 * device rather than about our instrumentation.
 */
export function factsFrom(env: FactsEnv): DeviceFacts {
  const facts: DeviceFacts = { platform: 'web' };
  if (env.version) facts.app = env.version;
  if (env.buildSha) facts.build = env.buildSha.slice(0, 7);
  if (env.locale) facts.locale = env.locale;
  if (env.timezone) facts.timezone = env.timezone;
  if (env.route) facts.route = env.route;
  return facts;
}

/**
 * Read the live environment.
 *
 * `NEXT_PUBLIC_BUILD_SHA` IS INLINED AT BUILD TIME by `next.config.ts`'s `env` block, the
 * same way `NEXT_PUBLIC_BUILD_YEAR` already is. It cannot be read dynamically: this app is
 * a static export, so there is no server to ask at request time.
 */
export function deviceFacts(route?: string): DeviceFacts {
  const intl =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined;
  return factsFrom({
    buildSha: process.env.NEXT_PUBLIC_BUILD_SHA,
    // The same source `status/page.tsx` renders as `v{pkg.version}`. A direct import is
    // this repo's existing pattern for the app version; inventing an env var for it would
    // be a second source of one number.
    version: pkg.version,
    locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
    timezone: intl,
    route,
  });
}

/** The sentence the sheet shows. Every key in `DeviceFacts` must be reachable from here. */
export function factLine(f: DeviceFacts): string {
  const parts = [
    f.platform,
    f.app ? `app ${f.app}` : null,
    f.build ? `build ${f.build}` : null,
    f.route,
    f.locale,
    f.timezone,
  ].filter(Boolean);
  return parts.join(' · ');
}
