import { describe, expect, it } from 'vitest';
import {
  canArchive,
  canTransition,
  getAllowedTransitions,
  isTerminalStatus,
  ORDER_STATUSES,
  transitionRequiresQuote,
} from '../order-status';

describe('order status transitions', () => {
  it('matches the admin transition table', () => {
    expect(getAllowedTransitions('SUBMITTED', 'ADMIN')).toEqual(['UNDER_REVIEW', 'CANCELLED']);
    expect(getAllowedTransitions('UNDER_REVIEW', 'ADMIN')).toEqual(['AWAITING_CUSTOMER_INFO', 'QUOTE_SENT', 'CANCELLED']);
    expect(getAllowedTransitions('AWAITING_CUSTOMER_INFO', 'ADMIN')).toEqual(['UNDER_REVIEW', 'QUOTE_SENT', 'CANCELLED']);
    expect(getAllowedTransitions('QUOTE_SENT', 'ADMIN')).toEqual([
      'ACCEPTED',
      'UNDER_REVIEW',
      'AWAITING_CUSTOMER_INFO',
      'CANCELLED',
    ]);
    expect(getAllowedTransitions('ACCEPTED', 'ADMIN')).toEqual(['IN_PROGRESS', 'CANCELLED']);
    expect(getAllowedTransitions('IN_PROGRESS', 'ADMIN')).toEqual(['COMPLETED', 'CANCELLED']);
  });

  it('matches the customer transition table', () => {
    for (const status of ['SUBMITTED', 'UNDER_REVIEW', 'AWAITING_CUSTOMER_INFO'] as const) {
      expect(getAllowedTransitions(status, 'CUSTOMER')).toEqual(['CANCELLED']);
    }
    expect(getAllowedTransitions('QUOTE_SENT', 'CUSTOMER')).toEqual(['ACCEPTED', 'CANCELLED']);
    for (const status of ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const) {
      expect(getAllowedTransitions(status, 'CUSTOMER')).toEqual([]);
    }
  });

  it('treats COMPLETED and CANCELLED as terminal for everyone', () => {
    for (const actor of ['ADMIN', 'CUSTOMER'] as const) {
      expect(getAllowedTransitions('COMPLETED', actor)).toEqual([]);
      expect(getAllowedTransitions('CANCELLED', actor)).toEqual([]);
    }
    expect(isTerminalStatus('COMPLETED')).toBe(true);
    expect(isTerminalStatus('CANCELLED')).toBe(true);
    expect(isTerminalStatus('IN_PROGRESS')).toBe(false);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition('SUBMITTED', 'COMPLETED', 'ADMIN')).toBe(false);
    expect(canTransition('SUBMITTED', 'QUOTE_SENT', 'ADMIN')).toBe(false);
    expect(canTransition('SUBMITTED', 'UNDER_REVIEW', 'CUSTOMER')).toBe(false);
    expect(canTransition('ACCEPTED', 'CANCELLED', 'CUSTOMER')).toBe(false);
    expect(canTransition('QUOTE_SENT', 'ACCEPTED', 'CUSTOMER')).toBe(true);
  });

  it('never allows a status to transition to itself', () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status, 'ADMIN')).toBe(false);
      expect(canTransition(status, status, 'CUSTOMER')).toBe(false);
    }
  });

  it('only allows archiving terminal orders', () => {
    const archivable = ORDER_STATUSES.filter(canArchive);
    expect(archivable).toEqual(['COMPLETED', 'CANCELLED']);
  });

  it('requires a quote only for QUOTE_SENT', () => {
    expect(ORDER_STATUSES.filter(transitionRequiresQuote)).toEqual(['QUOTE_SENT']);
  });
});
