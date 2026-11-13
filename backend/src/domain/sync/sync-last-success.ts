/** Fuentes externas cuya última sincronización exitosa se conserva (spec 031). */
export type SyncSourceId = 'whoscored' | 'football_data';

/** Momento de la última corrida exitosa (`success`) de una fuente. Una corrida parcial o fallida no lo modifica. */
export interface SyncLastSuccess {
  source: SyncSourceId;
  succeededAt: Date;
}
