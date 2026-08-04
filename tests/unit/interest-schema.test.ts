import { describe, it, expect } from 'vitest';
import {
  interestSchema,
  interestToContactPayload,
} from '@/schemas/interest.schema';

describe('interest.schema (#129)', () => {
  it('accepts a minimal valid signup', () => {
    const parsed = interestSchema.parse({
      email: '  Friend@Example.COM ',
      role: 'adopter',
    });
    expect(parsed.email).toBe('friend@example.com');
    expect(parsed.role).toBe('adopter');
  });

  it('maps to a contact email payload', () => {
    const payload = interestToContactPayload({
      email: 'a@b.co',
      name: 'Sam',
      role: 'other',
    });
    expect(payload.subject).toBe('Early interest list signup');
    expect(payload.message).toContain('a@b.co');
    expect(payload.message).toContain('Other');
  });
});
