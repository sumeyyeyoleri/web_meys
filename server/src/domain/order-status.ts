import { canTransition, transitionRequiresQuote, type OrderStatus, type StatusActor } from '@painter/shared';
import { AppError } from './errors';

/** Throws 409 ORDER_INVALID_TRANSITION / 400 ORDER_QUOTE_REQUIRED when a status change is not allowed. */
export function assertStatusTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: StatusActor,
  quoteAmount: number | undefined,
): void {
  if (!canTransition(from, to, actor)) {
    throw new AppError(409, 'ORDER_INVALID_TRANSITION', `Cannot change status from ${from} to ${to}`);
  }
  if (transitionRequiresQuote(to) && (quoteAmount === undefined || quoteAmount <= 0)) {
    throw new AppError(400, 'ORDER_QUOTE_REQUIRED', 'A quote amount is required', {
      quoteAmount: 'validation.quoteRequired',
    });
  }
}
