import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  submitToWeb3Forms,
  isRetryableError,
  calculateBackoffDelay,
  submitWithRetry,
  checkRateLimit,
  recordSubmission,
  clearRateLimitHistory,
  sanitizeFormData,
  validateWeb3FormsResponse,
  formatErrorMessage,
  WEB3FORMS_CONFIG,
  RETRY_CONFIG,
  RATE_LIMIT_CONFIG,
} from './web3forms';
import type { ContactFormData } from '@/schemas/contact.schema';
import { projectConfig } from '@/config/project.config';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variable
process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY = 'test-access-key';

// Mock localStorage
const localStorageMock: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStorageMock[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageMock).forEach(
      (key) => delete localStorageMock[key]
    );
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('Web3Forms Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    // Reset Date.now mock
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('submitToWeb3Forms', () => {
    const validFormData: ContactFormData = {
      name: 'John Doe',
      email: 'john@example.com',
      role: 'adopter',
      subject: 'Test Subject',
      message: 'This is a test message',
    };

    it('should successfully submit form data', async () => {
      const mockResponse = {
        success: true,
        message: 'Email sent successfully',
        data: {
          id: 'test-id',
          email: 'john@example.com',
          role: 'adopter',
          from_name: 'John Doe',
          subject: 'Test Subject',
          message: 'This is a test message',
          date: '2025-01-15T12:00:00Z',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await submitToWeb3Forms(validFormData);

      expect(mockFetch).toHaveBeenCalledWith(WEB3FORMS_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          access_key: WEB3FORMS_CONFIG.accessKey,
          ...validFormData,
          role_label: 'Adopter / applicant',
          subject: '[Adopter / applicant] Test Subject',
          from_name: 'Raised Paws Contact Form',
          botcheck: false,
        }),
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(submitToWeb3Forms(validFormData)).rejects.toThrow(
        'Network error'
      );
    });

    it('should handle non-ok responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(submitToWeb3Forms(validFormData)).rejects.toThrow(
        'HTTP error! status: 500'
      );
    });

    it('should handle API error responses', async () => {
      const errorResponse = {
        success: false,
        message: 'Invalid access key',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => errorResponse,
      });

      await expect(submitToWeb3Forms(validFormData)).rejects.toThrow(
        'Invalid access key'
      );
    });

    it('should sanitize form data before submission', async () => {
      const unsafeData: ContactFormData = {
        name: '<script>alert("XSS")</script>John',
        email: 'john@example.com',
        role: 'adopter',
        subject: 'Test<img src=x onerror=alert(1)>',
        message: 'Message with javascript:alert(1)',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Sent' }),
      });

      await submitToWeb3Forms(unsafeData);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.name).not.toContain('<script>');
      expect(callBody.subject).not.toContain('<img');
      expect(callBody.message).not.toContain('javascript:');
    });
  });

  describe('isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      const error = new Error('Network error');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify timeout errors as retryable', () => {
      const error = new Error('Request timeout');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify 5xx errors as retryable', () => {
      const error = new Error('HTTP error! status: 503');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify 429 errors as retryable', () => {
      const error = new Error('HTTP error! status: 429');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should not identify 4xx errors as retryable (except 429)', () => {
      const error = new Error('HTTP error! status: 400');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should not identify validation errors as retryable', () => {
      const error = new Error('Validation failed');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff correctly', () => {
      expect(calculateBackoffDelay(0)).toBe(RETRY_CONFIG.baseDelay);
      expect(calculateBackoffDelay(1)).toBe(
        RETRY_CONFIG.baseDelay * RETRY_CONFIG.backoffFactor
      );
      expect(calculateBackoffDelay(2)).toBe(
        RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, 2)
      );
    });

    it('should respect maximum delay', () => {
      const largeRetryCount = 10;
      expect(calculateBackoffDelay(largeRetryCount)).toBe(
        RETRY_CONFIG.maxDelay
      );
    });

    it('should add jitter to prevent thundering herd', () => {
      const delay1 = calculateBackoffDelay(1, true);
      // With jitter, consecutive calls should likely produce different results
      // We'll check that it's within expected range
      const expectedBase = RETRY_CONFIG.baseDelay * RETRY_CONFIG.backoffFactor;
      expect(delay1).toBeGreaterThanOrEqual(expectedBase * 0.5);
      expect(delay1).toBeLessThanOrEqual(expectedBase * 1.5);
    });
  });

  describe('submitWithRetry', () => {
    const validFormData: ContactFormData = {
      name: 'John Doe',
      email: 'john@example.com',
      role: 'adopter',
      subject: 'Test Subject',
      message: 'This is a test message',
    };

    it('should succeed on first try', async () => {
      const mockResponse = { success: true, message: 'Sent' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await submitWithRetry(validFormData);
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      const mockResponse = { success: true, message: 'Sent' };

      // First call fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const promise = submitWithRetry(validFormData);

      // Advance timers to handle the retry delay
      await vi.advanceTimersByTimeAsync(RETRY_CONFIG.baseDelay);

      const result = await promise;
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should respect max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const promise = submitWithRetry(validFormData).catch((e) => e);

      // Advance through all retry delays
      for (let i = 0; i < RETRY_CONFIG.maxRetries; i++) {
        await vi.advanceTimersByTimeAsync(calculateBackoffDelay(i));
      }

      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(RETRY_CONFIG.maxRetries + 1);
    });

    it('should not retry non-retryable errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Validation failed'));

      await expect(submitWithRetry(validFormData)).rejects.toThrow(
        'Validation failed'
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should apply backoff delays between retries', async () => {
      const mockResponse = { success: true, message: 'Sent' };

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const promise = submitWithRetry(validFormData);

      // Advance through retry delays
      await vi.advanceTimersByTimeAsync(calculateBackoffDelay(0));
      await vi.advanceTimersByTimeAsync(calculateBackoffDelay(1));

      const result = await promise;
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Rate Limiting', () => {
    describe('checkRateLimit', () => {
      it('should allow submissions when under limit', () => {
        expect(checkRateLimit()).toBe(true);
      });

      it('should block submissions when limit exceeded', () => {
        const now = Date.now();
        const submissions = Array(RATE_LIMIT_CONFIG.maxSubmissions)
          .fill(0)
          .map((_, i) => now - i * 1000);

        localStorageMock[RATE_LIMIT_CONFIG.storageKey] = JSON.stringify({
          submissions,
          blockedUntil: null,
        });

        expect(checkRateLimit()).toBe(false);
      });

      it('should only count recent submissions within time window', () => {
        const now = Date.now();
        const oldSubmission = now - RATE_LIMIT_CONFIG.timeWindow - 1000;
        const recentSubmissions = Array(RATE_LIMIT_CONFIG.maxSubmissions - 1)
          .fill(0)
          .map((_, i) => now - i * 1000);

        localStorageMock[RATE_LIMIT_CONFIG.storageKey] = JSON.stringify({
          submissions: [oldSubmission, ...recentSubmissions],
          blockedUntil: null,
        });

        expect(checkRateLimit()).toBe(true);
      });

      it('should respect block duration after limit exceeded', () => {
        const now = Date.now();
        const blockedUntil = now + 60000; // Blocked for 1 more minute

        localStorageMock[RATE_LIMIT_CONFIG.storageKey] = JSON.stringify({
          submissions: [],
          blockedUntil,
        });

        expect(checkRateLimit()).toBe(false);
      });

      it('should allow submissions after block duration expires', () => {
        const now = Date.now();
        const blockedUntil = now - 1000; // Block expired 1 second ago

        localStorageMock[RATE_LIMIT_CONFIG.storageKey] = JSON.stringify({
          submissions: [],
          blockedUntil,
        });

        expect(checkRateLimit()).toBe(true);
      });
    });

    describe('recordSubmission', () => {
      it('should record new submission', () => {
        recordSubmission();

        const data = JSON.parse(localStorageMock[RATE_LIMIT_CONFIG.storageKey]);
        expect(data.submissions).toHaveLength(1);
        expect(data.submissions[0]).toBe(Date.now());
      });

      it('should append to existing submissions', () => {
        const existingSubmission = Date.now() - 5000;
        localStorageMock[RATE_LIMIT_CONFIG.storageKey] = JSON.stringify({
          submissions: [existingSubmission],
          blockedUntil: null,
        });

        recordSubmission();

        const data = JSON.parse(localStorageMock[RATE_LIMIT_CONFIG.storageKey]);
        expect(data.submissions).toHaveLength(2);
      });

      it('should set block time when limit exceeded', () => {
        const submissions = Array(RATE_LIMIT_CONFIG.maxSubmissions - 1)
          .fill(0)
          .map((_, i) => Date.now() - i * 1000);

        localStorageMock[RATE_LIMIT_CONFIG.storageKey] = JSON.stringify({
          submissions,
          blockedUntil: null,
        });

        recordSubmission();

        const data = JSON.parse(localStorageMock[RATE_LIMIT_CONFIG.storageKey]);
        expect(data.blockedUntil).toBeGreaterThan(Date.now());
        expect(data.blockedUntil).toBe(
          Date.now() + RATE_LIMIT_CONFIG.blockDuration
        );
      });
    });

    describe('clearRateLimitHistory', () => {
      it('should clear rate limit data', () => {
        localStorageMock[RATE_LIMIT_CONFIG.storageKey] = JSON.stringify({
          submissions: [Date.now()],
          blockedUntil: Date.now() + 60000,
        });

        clearRateLimitHistory();

        expect(localStorageMock[RATE_LIMIT_CONFIG.storageKey]).toBeUndefined();
      });
    });
  });

  describe('sanitizeFormData', () => {
    it('should remove script tags', () => {
      const input: ContactFormData = {
        name: '<script>alert("XSS")</script>John',
        email: 'john@example.com',
        role: 'adopter',
        subject: 'Test',
        message: 'Hello <script>evil()</script> world',
      };

      const result = sanitizeFormData(input);
      expect(result.name).toBe('John');
      expect(result.message).toBe('Hello  world');
    });

    it('should remove event handlers', () => {
      const input: ContactFormData = {
        name: 'John',
        email: 'john@example.com',
        role: 'adopter',
        subject: 'Test <span onclick="alert(1)">click</span>',
        message: 'Test message',
      };

      const result = sanitizeFormData(input);
      expect(result.subject).not.toContain('onclick');
    });

    it('should remove javascript: URLs', () => {
      const input: ContactFormData = {
        name: 'John',
        email: 'john@example.com',
        role: 'adopter',
        subject: 'Test',
        message: 'Click <a href="javascript:void(0)">here</a>',
      };

      const result = sanitizeFormData(input);
      expect(result.message).not.toContain('javascript:');
    });

    it('should preserve safe content', () => {
      const input: ContactFormData = {
        name: "John O'Connor Jr.",
        email: 'john@example.com',
        role: 'adopter',
        subject: 'Question about pricing & features',
        message: 'I have a question: Is this < $100?',
      };

      const result = sanitizeFormData(input);
      expect(result.name).toBe("John O'Connor Jr.");
      expect(result.subject).toBe('Question about pricing & features');
      expect(result.message).toContain('< $100');
    });
  });

  describe('validateWeb3FormsResponse', () => {
    it('should validate successful response', () => {
      const response = {
        success: true,
        message: 'Email sent',
        data: {
          id: '123',
          email: 'test@example.com',
          role: 'adopter',
        },
      };

      expect(() => validateWeb3FormsResponse(response)).not.toThrow();
    });

    it('should validate error response', () => {
      const response = {
        success: false,
        message: 'Invalid access key',
      };

      expect(() => validateWeb3FormsResponse(response)).not.toThrow();
    });

    it('should throw on invalid response structure', () => {
      const invalidResponse = {
        // Missing required fields
        data: {},
      };

      expect(() => validateWeb3FormsResponse(invalidResponse)).toThrow();
    });

    it('should throw on non-object response', () => {
      expect(() => validateWeb3FormsResponse(null)).toThrow();
      expect(() => validateWeb3FormsResponse(undefined)).toThrow();
      expect(() => validateWeb3FormsResponse('string')).toThrow();
    });
  });
});

/**
 * `formatErrorMessage` had NO tests, which is how a dead contact form stayed quiet.
 *
 * The function owns every sentence a visitor reads when a submission fails. One of
 * its branches — the one that would have named a configuration fault — was
 * unreachable for months because EmailService rewrites the provider's message, so
 * every misconfigured deploy rendered "An error occurred. Please try again later."
 * on the only channel anyone had for reporting that it did not work.
 */
describe('formatErrorMessage', () => {
  it('names a configuration fault rather than blaming the network', () => {
    // The three shapes this can arrive in: the provider's own wording, the
    // EmailService aggregate that replaces it, and the Edge Function's 500 body.
    for (const raw of [
      'Web3Forms access key is not configured',
      'No email providers available. Please check configuration.',
      'Contact delivery is not configured',
      // The aggregate EmailService throws once every provider has failed at
      // send-time — the path a misconfigured Edge Function actually takes.
      'All email providers failed: Contact delivery is not configured',
      // The shape production ACTUALLY produced while the function was referenced
      // by the bundle but not yet deployed. It contains neither "access key" nor
      // "no email providers" nor "not configured", so the first version of this
      // guard missed it and the visitor got the generic sentence again.
      'All email providers failed: Contact function returned 404',
    ]) {
      const message = formatErrorMessage(new Error(raw));
      expect(message).not.toContain('try again later');
      expect(message).toContain('@');
    }
  });

  it('does not tell a visitor to contact support through the broken form', () => {
    const message = formatErrorMessage(
      new Error('No email providers available. Please check configuration.')
    );
    // Circular advice: "contact support" was reachable only through the form that
    // had just failed. The replacement must name a channel that still works, so
    // assert BOTH halves — otherwise this passes on the old generic message too.
    expect(message.toLowerCase()).not.toContain('contact support');
    expect(message).toContain(projectConfig.contactEmail);
  });

  it('still distinguishes genuinely transient failures', () => {
    expect(formatErrorMessage(new Error('Network request failed'))).toContain(
      'Network error'
    );
    expect(formatErrorMessage(new Error('Request timeout'))).toContain(
      'timed out'
    );
    expect(formatErrorMessage(new Error('rate limit exceeded'))).toContain(
      'Too many requests'
    );
  });

  it('falls back to the generic message only for genuinely unknown errors', () => {
    expect(formatErrorMessage(new Error('kaboom'))).toBe(
      'An error occurred. Please try again later.'
    );
  });
});
