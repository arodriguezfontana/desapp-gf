import { InsufficientHoldingError } from '../../domain/portfolio/errors/insufficient-holding.error';
import { PlayerNotFoundError } from '../../domain/player/errors/player-not-found.error';
import { DomainError } from '../../shared/errors/domain-error';
import { rejectionReasonOf } from './order-rejection-reason';

describe('rejectionReasonOf', () => {
  it('InsufficientHoldingError -> insufficient_tokens', () => {
    expect(rejectionReasonOf(new InsufficientHoldingError())).toBe('insufficient_tokens');
  });

  it('un error de dominio sin motivo propio -> other', () => {
    expect(rejectionReasonOf(new PlayerNotFoundError())).toBe('other');
    expect(rejectionReasonOf(new (class Nuevo extends DomainError {})('x'))).toBe('other');
  });

  it('un error común o un valor que no es un error -> other', () => {
    expect(rejectionReasonOf(new Error('boom'))).toBe('other');
    expect(rejectionReasonOf('texto')).toBe('other');
    expect(rejectionReasonOf(undefined)).toBe('other');
  });
});
