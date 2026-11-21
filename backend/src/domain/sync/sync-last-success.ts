import { SyncSource } from './sync-source';

/** Momento de la última corrida exitosa (`success`) de una fuente. Una corrida parcial o fallida no lo modifica. */
export interface SyncLastSuccess {
  source: SyncSource;
  succeededAt: Date;
}
