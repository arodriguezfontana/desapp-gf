import { QueryFailedError } from 'typeorm';

/** `true` si `error` es un `QueryFailedError` de Postgres con este código (p. ej. `23505`, `22P02`). */
export function isPostgresErrorCode(error: unknown, code: string): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as { driverError?: { code?: string } }).driverError?.code === code
  );
}
