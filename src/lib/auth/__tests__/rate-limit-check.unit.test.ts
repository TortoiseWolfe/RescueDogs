// Security Hardening: Rate Limiting Unit Tests
// Feature 017 - Task T009 (Refactored for proper unit testing)
// Purpose: Test rate limiting business logic without database dependency

import { describe, it, expect } from 'vitest';
import {
  formatLockoutTime,
  isAuthRequestRateLimited,
  AUTH_REQUEST_RATE_LIMIT_MESSAGE,
} from '../rate-limit-check';

describe('Rate Limiting - Unit Tests', () => {
  describe('formatLockoutTime', () => {
    it('should format time remaining correctly', () => {
      const oneMinute = new Date(Date.now() + 60 * 1000).toISOString();
      expect(formatLockoutTime(oneMinute)).toBe('1 minute');

      const fiveMinutes = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      expect(formatLockoutTime(fiveMinutes)).toBe('5 minutes');

      const fifteenMinutes = new Date(
        Date.now() + 15 * 60 * 1000
      ).toISOString();
      expect(formatLockoutTime(fifteenMinutes)).toBe('15 minutes');
    });

    it('should return "shortly" for expired locks', () => {
      const pastTime = new Date(Date.now() - 1000).toISOString();
      expect(formatLockoutTime(pastTime)).toBe('shortly');
    });

    it('should handle fractional minutes correctly', () => {
      const thirtySeconds = new Date(Date.now() + 30 * 1000).toISOString();
      expect(formatLockoutTime(thirtySeconds)).toBe('1 minute'); // Rounds up

      const ninetySeconds = new Date(Date.now() + 90 * 1000).toISOString();
      expect(formatLockoutTime(ninetySeconds)).toBe('2 minutes'); // Rounds up
    });
  });

  describe('isAuthRequestRateLimited (#81)', () => {
    it('detects HTTP 429 status', () => {
      expect(isAuthRequestRateLimited({ status: 429, message: 'x' })).toBe(
        true
      );
    });

    it('detects over_request_rate_limit code', () => {
      expect(
        isAuthRequestRateLimited({
          code: 'over_request_rate_limit',
          message: 'Request rate limit reached',
        })
      ).toBe(true);
    });

    it('detects Request rate limit reached message', () => {
      expect(
        isAuthRequestRateLimited({
          message: 'Request rate limit reached',
        })
      ).toBe(true);
    });

    it('does not treat wrong password as request rate limit', () => {
      expect(
        isAuthRequestRateLimited({
          message: 'Invalid login credentials',
          status: 400,
        })
      ).toBe(false);
    });

    it('exposes a clear user-facing message constant', () => {
      expect(AUTH_REQUEST_RATE_LIMIT_MESSAGE).toMatch(/wait a few minutes/i);
      expect(AUTH_REQUEST_RATE_LIMIT_MESSAGE).not.toMatch(
        /attempts remaining/i
      );
    });

    it('documents the per-email max attempts constant', async () => {
      const { AUTH_RATE_LIMIT_MAX_ATTEMPTS } = await import(
        '../rate-limit-check'
      );
      expect(AUTH_RATE_LIMIT_MAX_ATTEMPTS).toBe(15);
    });
  });
});
