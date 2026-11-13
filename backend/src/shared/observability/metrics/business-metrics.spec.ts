import {
  classifySyncRun,
  NOTIFICATION_DELIVERIES,
  OPERATION_OUTCOMES,
  RECALCULATION_OUTCOMES,
  REJECTION_REASONS,
  RUN_TRIGGERS,
  SIDES,
  SYNC_OUTCOMES,
  SYNC_SOURCES,
} from './business-metrics';

describe('classifySyncRun', () => {
  it('success: no abortó y ninguna unidad falló', () => {
    expect(classifySyncRun({ aborted: false, unitsSucceeded: 10, unitsFailed: 0 })).toBe('success');
  });

  it('success: sin unidades fallidas aunque no haya procesado ninguna', () => {
    expect(classifySyncRun({ aborted: false, unitsSucceeded: 0, unitsFailed: 0 })).toBe('success');
  });

  it('partial: algunas unidades fallaron y otras terminaron bien', () => {
    expect(classifySyncRun({ aborted: false, unitsSucceeded: 7, unitsFailed: 3 })).toBe('partial');
    expect(classifySyncRun({ aborted: false, unitsSucceeded: 1, unitsFailed: 99 })).toBe('partial');
  });

  it('failure: ninguna unidad terminó bien', () => {
    expect(classifySyncRun({ aborted: false, unitsSucceeded: 0, unitsFailed: 5 })).toBe('failure');
  });

  it('failure: la corrida se abortó, aunque hubiera unidades buenas', () => {
    expect(classifySyncRun({ aborted: true, unitsSucceeded: 0, unitsFailed: 0 })).toBe('failure');
    expect(classifySyncRun({ aborted: true, unitsSucceeded: 4, unitsFailed: 1 })).toBe('failure');
  });
});

describe('conjuntos cerrados de etiquetas', () => {
  it('contienen exactamente los valores de la spec 031', () => {
    expect([...SIDES]).toEqual(['buy', 'sell']);
    expect([...OPERATION_OUTCOMES]).toEqual(['success', 'rejected', 'unexpected']);
    expect([...SYNC_OUTCOMES]).toEqual(['success', 'partial', 'failure']);
    expect([...RECALCULATION_OUTCOMES]).toEqual(['success', 'failure']);
    expect([...REJECTION_REASONS]).toEqual([
      'insufficient_balance',
      'insufficient_tokens',
      'tokens_unavailable',
      'other',
    ]);
    expect([...SYNC_SOURCES]).toEqual(['whoscored', 'football_data']);
    expect([...RUN_TRIGGERS]).toEqual(['scheduled', 'manual']);
    expect([...NOTIFICATION_DELIVERIES]).toEqual(['live', 'stored_only']);
  });
});
