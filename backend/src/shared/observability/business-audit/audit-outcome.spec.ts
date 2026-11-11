import { BadRequestException, ForbiddenException, HttpException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DomainError } from '../../errors/domain-error';
import { InsufficientHoldingError } from '../../../domain/portfolio/errors/insufficient-holding.error';
import { ANONYMOUS_ACTOR, classifyFailure, resolveActor, SYSTEM_ACTOR } from './audit-outcome';

describe('classifyFailure', () => {
  it('un DomainError es un rechazo por regla de negocio', () => {
    expect(classifyFailure(new InsufficientHoldingError())).toBe('rejected');
    expect(classifyFailure(new (class extends DomainError {})('x'))).toBe('rejected');
  });

  it.each([
    ['400', new BadRequestException()],
    ['403', new ForbiddenException()],
    ['404', new NotFoundException()],
    ['409', new HttpException('conflicto', 409)],
  ])('un HttpException %s es un rechazo', (_status, error) => {
    expect(classifyFailure(error)).toBe('rejected');
  });

  it('un HttpException 500 es un error inesperado', () => {
    expect(classifyFailure(new InternalServerErrorException())).toBe('unexpected');
  });

  it('un Error común es un error inesperado', () => {
    expect(classifyFailure(new Error('boom'))).toBe('unexpected');
  });

  it.each([[undefined], [null], ['texto'], [42]])('un valor que no es un Error (%p) es un error inesperado', (value) => {
    expect(classifyFailure(value)).toBe('unexpected');
  });
});

describe('resolveActor', () => {
  it('devuelve el identificador del usuario autenticado, cualquiera sea lo declarado', () => {
    const req = { user: { userId: 'user-1' } };

    expect(resolveActor(req, 'user')).toBe('user-1');
    expect(resolveActor(req, 'system')).toBe('user-1');
    expect(resolveActor(req, 'anonymous')).toBe('user-1');
  });

  it('sin usuario y declarada de sistema devuelve "sistema"', () => {
    expect(resolveActor({}, 'system')).toBe(SYSTEM_ACTOR);
    expect(SYSTEM_ACTOR).toBe('sistema');
  });

  it('sin usuario y declarada anónima, o sin declaración, devuelve "anónimo"', () => {
    expect(resolveActor({}, 'anonymous')).toBe(ANONYMOUS_ACTOR);
    expect(resolveActor({})).toBe(ANONYMOUS_ACTOR);
    expect(ANONYMOUS_ACTOR).toBe('anónimo');
  });

  it('nunca lee el header de la API key: el valor no se usa ni se devuelve', () => {
    const req = { user: undefined, headers: { 'x-api-key': 'pmk_secreto' } } as never;

    const actor = resolveActor(req, 'system');

    expect(actor).toBe('sistema');
    expect(actor).not.toContain('pmk_secreto');
  });
});
