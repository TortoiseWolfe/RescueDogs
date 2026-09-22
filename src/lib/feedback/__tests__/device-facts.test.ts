import { describe, it, expect } from 'vitest';
import { factsFrom, factLine } from '../device-facts';

describe('factsFrom — what a bug report is allowed to carry', () => {
  it('always says which platform, because a web-only report still needs one', () => {
    expect(factsFrom({}).platform).toBe('web');
  });

  /**
   * OMITTED, NOT STRINGIFIED. A missing value left in becomes the literal "undefined" in a
   * JSON column and then in an issue body, where it reads as a fact about the reporter's
   * browser rather than about our own instrumentation.
   */
  it('omits what it does not have rather than writing "undefined"', () => {
    const f = factsFrom({});
    expect(Object.keys(f)).toEqual(['platform']);
    expect(JSON.stringify(f)).not.toContain('undefined');
  });

  it('shortens the build sha, because nobody reads forty characters', () => {
    expect(factsFrom({ buildSha: 'abcdef1234567890' }).build).toBe('abcdef1');
  });

  it('carries the route, so a report from /apply is not a report from /', () => {
    expect(factsFrom({ route: '/apply' }).route).toBe('/apply');
  });

  /**
   * THE FINGERPRINT THAT MUST NOT TRAVEL. A user agent identifies a browser far more
   * precisely than "web" does, and a bug report is not a place to collect one. Nothing in
   * the input shape can put it there -- this asserts the shape stays that way.
   */
  it('has no field a user agent could be put in', () => {
    const f = factsFrom({
      buildSha: 'a'.repeat(40),
      version: '1.2.3',
      locale: 'en-GB',
      timezone: 'Europe/London',
      route: '/',
    });
    expect(Object.keys(f).sort()).toEqual(
      ['app', 'build', 'locale', 'platform', 'route', 'timezone'].sort()
    );
  });
});

describe('factLine — SHOWN, not harvested', () => {
  /**
   * The sheet prints this before sending. If a field can reach the database without
   * reaching this sentence, the promise on that sheet has quietly stopped being true --
   * so this walks every key rather than spot-checking a few.
   */
  it('shows every fact that travels', () => {
    const f = factsFrom({
      buildSha: 'abcdef1234567890',
      version: '1.2.3',
      locale: 'en-GB',
      timezone: 'Europe/London',
      route: '/apply',
    });
    const line = factLine(f);
    for (const value of Object.values(f)) {
      expect(line).toContain(String(value));
    }
  });

  it('prints no empty separators when there is little to say', () => {
    expect(factLine({ platform: 'web' })).toBe('web');
  });
});
