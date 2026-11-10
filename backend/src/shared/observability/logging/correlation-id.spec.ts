import {
  CORRELATION_ID_HEADER,
  MAX_CORRELATION_ID_LENGTH,
  resolveCorrelationId,
} from './correlation-id';

describe('resolveCorrelationId', () => {
  const generate = () => 'generado-123';

  it('el header se llama X-Correlation-Id y el máximo es de 64 caracteres', () => {
    expect(CORRELATION_ID_HEADER).toBe('X-Correlation-Id');
    expect(MAX_CORRELATION_ID_LENGTH).toBe(64);
  });

  it.each([
    'mi-id-123',
    'retry:7f3a.001_x',
    '3b1f2c60-8a0e-4d7b-9f1e-0a1b2c3d4e5f',
    'a',
    'x'.repeat(64),
  ])('reutiliza el valor entrante válido %s', (incoming) => {
    const spy = jest.fn(generate);

    expect(resolveCorrelationId(incoming, spy)).toBe(incoming);
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    ['undefined', undefined],
    ['cadena vacía', ''],
    ['65 caracteres', 'x'.repeat(65)],
    ['con espacio', 'a b'],
    ['con comillas', 'a"b'],
    ['con comilla simple', "a'b"],
    ['con salto de línea', 'a\nb'],
    ['con retorno de carro', 'a\rb'],
    ['con carácter de control', 'a\u0000b'],
    ['con menor que', '<script>'],
    ['con barra', 'a/b'],
    ['con tilde', 'identificación'],
    ['header repetido (arreglo)', ['uno', 'dos']],
  ])('descarta el valor entrante inválido: %s', (_label, incoming) => {
    const spy = jest.fn(generate);

    expect(resolveCorrelationId(incoming as string | string[] | undefined, spy)).toBe(
      'generado-123',
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('por defecto genera un UUID v4', () => {
    expect(resolveCorrelationId(undefined)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
