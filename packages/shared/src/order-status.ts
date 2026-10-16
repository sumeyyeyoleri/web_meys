export const ORDER_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'AWAITING_CUSTOMER_INFO',
  'QUOTE_SENT',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type StatusActor = 'ADMIN' | 'CUSTOMER';

const ADMIN_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['AWAITING_CUSTOMER_INFO', 'QUOTE_SENT', 'CANCELLED'],
  AWAITING_CUSTOMER_INFO: ['UNDER_REVIEW', 'QUOTE_SENT', 'CANCELLED'],
  QUOTE_SENT: ['ACCEPTED', 'UNDER_REVIEW', 'AWAITING_CUSTOMER_INFO', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const CUSTOMER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  SUBMITTED: ['CANCELLED'],
  UNDER_REVIEW: ['CANCELLED'],
  AWAITING_CUSTOMER_INFO: ['CANCELLED'],
  QUOTE_SENT: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: [],
  IN_PROGRESS: [],
  COMPLETED: [],
  CANCELLED: [],
};

export const TERMINAL_STATUSES: readonly OrderStatus[] = ['COMPLETED', 'CANCELLED'];

/** Statuses an order may be moved to by the given actor. */
export function getAllowedTransitions(from: OrderStatus, actor: StatusActor): readonly OrderStatus[] {
  return actor === 'ADMIN' ? ADMIN_TRANSITIONS[from] : CUSTOMER_TRANSITIONS[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus, actor: StatusActor): boolean {
  return getAllowedTransitions(from, actor).includes(to);
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Only finished or cancelled orders can be archived. */
export function canArchive(status: OrderStatus): boolean {
  return isTerminalStatus(status);
}

/** Moving to QUOTE_SENT requires a quote amount. */
export function transitionRequiresQuote(to: OrderStatus): boolean {
  return to === 'QUOTE_SENT';
}
