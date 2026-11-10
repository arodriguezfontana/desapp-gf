import { resolveLogLevel } from './log-level';

describe('resolveLogLevel', () => {
  it.each(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])(
    'respeta LOG_LEVEL=%s',
    (level) => {
      expect(resolveLogLevel(level, 'production')).toBe(level);
    },
  );

  it('normaliza mayúsculas y espacios', () => {
    expect(resolveLogLevel('  WARN ', 'production')).toBe('warn');
  });

  it('LOG_LEVEL tiene prioridad sobre el default del entorno', () => {
    expect(resolveLogLevel('error', 'test')).toBe('error');
    expect(resolveLogLevel('info', 'development')).toBe('info');
  });

  it('sin LOG_LEVEL: debug en development, silent en test, info en cualquier otro caso', () => {
    expect(resolveLogLevel(undefined, 'development')).toBe('debug');
    expect(resolveLogLevel(undefined, 'test')).toBe('silent');
    expect(resolveLogLevel(undefined, 'production')).toBe('info');
    expect(resolveLogLevel(undefined, undefined)).toBe('info');
  });

  it('un LOG_LEVEL inválido o vacío cae al default del entorno', () => {
    expect(resolveLogLevel('ruidoso', 'development')).toBe('debug');
    expect(resolveLogLevel('', 'test')).toBe('silent');
    expect(resolveLogLevel('verbose', 'production')).toBe('info');
  });
});
