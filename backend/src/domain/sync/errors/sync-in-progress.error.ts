import { DomainError } from '../../../shared/errors/domain-error';
import { SYNC_IN_PROGRESS_MESSAGE } from '../../../shared/errors/messages';

/**
 * Ya hay una sincronización en curso de la misma feature (spec 009, FR-015).
 * `runId` identifica la corrida en curso; se incluye en el 409 cuando la
 * feature tiene estado de corrida (WhoScored). Football-Data no lo tiene.
 */
export class SyncInProgressError extends DomainError {
  constructor(public readonly runId?: string) {
    super(SYNC_IN_PROGRESS_MESSAGE);
  }
}
