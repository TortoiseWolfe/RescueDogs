import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  explicitTransportState,
  normalizeTransportStates,
  stateName,
} from './transport-states';

describe('transport-states', () => {
  it('explicitTransportState trims, uppercases and validates', () => {
    expect(explicitTransportState(' nj ')).toBe('NJ');
    expect(explicitTransportState('ZZ')).toBeUndefined();
    expect(explicitTransportState('')).toBeUndefined();
    expect(explicitTransportState(null)).toBeUndefined();
  });

  it('normalizeTransportStates de-duplicates and drops unknown codes', () => {
    expect(normalizeTransportStates([' nj ', 'NJ', 'ny', 'ZZ', null])).toEqual([
      'NJ',
      'NY',
    ]);
  });

  it('stateName falls back to the code itself', () => {
    expect(stateName('nj')).toBe('New Jersey');
    expect(stateName('ZZ')).toBe('ZZ');
  });

  it('the service layer never statically imports the ZIP database', () => {
    for (const file of [
      'application-service.ts',
      'shelter-application-service.ts',
    ]) {
      const source = readFileSync(`src/services/applications/${file}`, 'utf8');
      expect(source).not.toMatch(/from ['"]zipcodes['"]/);
      expect(source).not.toMatch(
        /from ['"]@\/lib\/browse\/(transport|distance)['"]/
      );
    }
  });
});
