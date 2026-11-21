import { safely, safelyAsync } from './safely';

describe('safely', () => {
  it('ejecuta la medición', () => {
    const work = jest.fn();

    safely(work);

    expect(work).toHaveBeenCalledTimes(1);
  });

  it('se traga cualquier fallo', () => {
    expect(() =>
      safely(() => {
        throw new Error('métricas rotas');
      }),
    ).not.toThrow();
  });
});

describe('safelyAsync', () => {
  it('espera la medición', async () => {
    let done = false;

    await safelyAsync(async () => {
      await Promise.resolve();
      done = true;
    });

    expect(done).toBe(true);
  });

  it('se traga un fallo síncrono y uno de la promesa', async () => {
    await expect(
      safelyAsync(() => {
        throw new Error('síncrono');
      }),
    ).resolves.toBeUndefined();
    await expect(safelyAsync(() => Promise.reject(new Error('asíncrono')))).resolves.toBeUndefined();
  });
});
