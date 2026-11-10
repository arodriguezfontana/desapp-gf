import { RunLock } from './run-lock';

describe('RunLock', () => {
  describe('tryAcquire / release', () => {
    it('nace libre', () => {
      const lock = new RunLock();

      expect(lock.isLocked).toBe(false);
      expect(lock.currentRunId).toBeNull();
    });

    it('toma el candado y guarda el identificador de la corrida', () => {
      const lock = new RunLock();

      expect(lock.tryAcquire('run-1')).toBe(true);
      expect(lock.isLocked).toBe(true);
      expect(lock.currentRunId).toBe('run-1');
    });

    it('no permite tomarlo dos veces y conserva la corrida original', () => {
      const lock = new RunLock();
      lock.tryAcquire('run-1');

      expect(lock.tryAcquire('run-2')).toBe(false);
      expect(lock.currentRunId).toBe('run-1');
    });

    it('al soltarlo vuelve a quedar libre', () => {
      const lock = new RunLock();
      lock.tryAcquire('run-1');

      lock.release();

      expect(lock.isLocked).toBe(false);
      expect(lock.tryAcquire('run-2')).toBe(true);
    });
  });

  describe('runExclusive', () => {
    it('devuelve el resultado del trabajo y suelta el candado', async () => {
      const lock = new RunLock();

      const result = await lock.runExclusive(async () => 42, () => new Error('ocupado'));

      expect(result).toBe(42);
      expect(lock.isLocked).toBe(false);
    });

    it('mantiene el candado tomado mientras el trabajo corre', async () => {
      const lock = new RunLock();
      let lockedDuringWork = false;

      await lock.runExclusive(
        async () => {
          lockedDuringWork = lock.isLocked;
        },
        () => new Error('ocupado'),
      );

      expect(lockedDuringWork).toBe(true);
    });

    it('lanza el error de onBusy sin ejecutar el trabajo si ya estaba tomado', async () => {
      const lock = new RunLock();
      lock.tryAcquire('run-1');
      const work = jest.fn();

      await expect(lock.runExclusive(work, () => new Error('ocupado'))).rejects.toThrow('ocupado');

      expect(work).not.toHaveBeenCalled();
    });

    it('no suelta el candado de la corrida que ya lo tenía cuando rechaza una segunda', async () => {
      const lock = new RunLock();
      lock.tryAcquire('run-1');

      await expect(lock.runExclusive(async () => 1, () => new Error('ocupado'))).rejects.toThrow();

      expect(lock.isLocked).toBe(true);
      expect(lock.currentRunId).toBe('run-1');
    });

    it('suelta el candado aunque el trabajo falle y propaga el error', async () => {
      const lock = new RunLock();

      await expect(
        lock.runExclusive(
          async () => {
            throw new Error('falló el trabajo');
          },
          () => new Error('ocupado'),
        ),
      ).rejects.toThrow('falló el trabajo');

      expect(lock.isLocked).toBe(false);
    });
  });

  describe('runIfFree', () => {
    it('corre el trabajo, suelta el candado y devuelve true', async () => {
      const lock = new RunLock();
      const work = jest.fn().mockResolvedValue(undefined);

      const ran = await lock.runIfFree(work);

      expect(ran).toBe(true);
      expect(work).toHaveBeenCalledTimes(1);
      expect(lock.isLocked).toBe(false);
    });

    it('si el candado está tomado no corre el trabajo y devuelve false', async () => {
      const lock = new RunLock();
      lock.tryAcquire('run-1');
      const work = jest.fn();

      const ran = await lock.runIfFree(work);

      expect(ran).toBe(false);
      expect(work).not.toHaveBeenCalled();
      expect(lock.currentRunId).toBe('run-1');
    });

    it('suelta el candado aunque el trabajo falle', async () => {
      const lock = new RunLock();

      await expect(
        lock.runIfFree(async () => {
          throw new Error('falló el trabajo');
        }),
      ).rejects.toThrow('falló el trabajo');

      expect(lock.isLocked).toBe(false);
    });
  });
});
