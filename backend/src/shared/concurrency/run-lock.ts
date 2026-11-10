/**
 * Candado en memoria para procesos largos que no deben solaparse: el recálculo
 * de cotizaciones y las sincronizaciones de WhoScored, Football-Data y del
 * crosswalk de equipos.
 *
 * Vale para un solo proceso: cada instancia del servidor tiene su propio
 * candado. No sobrevive a un reinicio, y no hace falta: si el proceso muere, la
 * corrida muere con él. Los bloqueos del mercado, en cambio, viven en la base
 * de datos (`FOR UPDATE`).
 */
export class RunLock {
  private activeRunId: string | null = null;

  get isLocked(): boolean {
    return this.activeRunId !== null;
  }

  /** Identificador de la corrida que tiene el candado, o `null` si está libre. */
  get currentRunId(): string | null {
    return this.activeRunId;
  }

  /** Toma el candado si está libre; devuelve `false` si ya estaba tomado. */
  tryAcquire(runId = 'run'): boolean {
    if (this.activeRunId !== null) {
      return false;
    }
    this.activeRunId = runId;
    return true;
  }

  release(): void {
    this.activeRunId = null;
  }

  /**
   * Corre `work` con el candado tomado y lo suelta siempre, haya salido bien o
   * mal. Si ya estaba tomado, lanza el error que devuelve `onBusy` sin ejecutar
   * `work` (y sin soltar el candado de la corrida que lo tiene).
   */
  async runExclusive<T>(work: () => Promise<T>, onBusy: () => Error): Promise<T> {
    if (!this.tryAcquire()) {
      throw onBusy();
    }
    try {
      return await work();
    } finally {
      this.release();
    }
  }

  /**
   * Como `runExclusive`, pero si el candado está tomado no lanza: devuelve
   * `false` para que quien llama (un cron) se salte la ejecución. Devuelve
   * `true` si `work` llegó a correr.
   */
  async runIfFree(work: () => Promise<void>): Promise<boolean> {
    if (!this.tryAcquire()) {
      return false;
    }
    try {
      await work();
    } finally {
      this.release();
    }
    return true;
  }
}
