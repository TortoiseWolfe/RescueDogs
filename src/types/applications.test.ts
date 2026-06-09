import { describe, it, expect } from 'vitest';
import {
  STATUS_ORDER,
  STATUS_TRANSITIONS,
  STATUS_LABELS,
  TERMINAL_STATUSES,
  isTerminalStatus,
  isRenting,
  type ApplicationStatus,
} from './applications';

const ALL_STATUSES = Object.keys(STATUS_TRANSITIONS) as ApplicationStatus[];

describe('STATUS_TRANSITIONS', () => {
  it('terminal statuses have no exits', () => {
    for (const status of TERMINAL_STATUSES) {
      expect(STATUS_TRANSITIONS[status]).toEqual([]);
    }
  });

  it('withdrawn is never reachable via staff transitions', () => {
    for (const status of ALL_STATUSES) {
      expect(STATUS_TRANSITIONS[status]).not.toContain('withdrawn');
    }
  });

  it('every active status can reach not_selected (honest rejection, Principle I)', () => {
    const active = ALL_STATUSES.filter((s) => !isTerminalStatus(s));
    for (const status of active) {
      expect(STATUS_TRANSITIONS[status]).toContain('not_selected');
    }
  });

  it('every transition target is a known status', () => {
    for (const status of ALL_STATUSES) {
      for (const target of STATUS_TRANSITIONS[status]) {
        expect(ALL_STATUSES).toContain(target);
      }
    }
  });

  it('no status transitions to itself', () => {
    for (const status of ALL_STATUSES) {
      expect(STATUS_TRANSITIONS[status]).not.toContain(status);
    }
  });

  it('pipeline only moves forward along STATUS_ORDER', () => {
    for (let i = 0; i < STATUS_ORDER.length; i++) {
      const targets = STATUS_TRANSITIONS[STATUS_ORDER[i]];
      for (const target of targets) {
        const targetIndex = STATUS_ORDER.indexOf(
          target as (typeof STATUS_ORDER)[number]
        );
        if (targetIndex !== -1) {
          expect(targetIndex).toBeGreaterThan(i);
        }
      }
    }
  });
});

describe('isTerminalStatus', () => {
  it('matches TERMINAL_STATUSES exactly', () => {
    for (const status of ALL_STATUSES) {
      expect(isTerminalStatus(status)).toBe(
        (TERMINAL_STATUSES as readonly string[]).includes(status)
      );
    }
  });
});

describe('STATUS_LABELS', () => {
  it('labels every status', () => {
    for (const status of ALL_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe('isRenting', () => {
  it('is true only for rental housing types', () => {
    expect(isRenting('rent_house')).toBe(true);
    expect(isRenting('rent_apartment')).toBe(true);
    expect(isRenting('own_house')).toBe(false);
    expect(isRenting('own_condo')).toBe(false);
    expect(isRenting('other')).toBe(false);
  });
});
