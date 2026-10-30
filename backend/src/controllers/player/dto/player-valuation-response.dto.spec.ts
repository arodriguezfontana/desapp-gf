import { Position } from '../../../domain/player/enums/position';
import { ValuationResult } from '../../../services/quotation/quotation.service';
import { PlayerValuationResponseDto } from './player-valuation-response.dto';

const result = (overrides: Partial<ValuationResult> = {}): ValuationResult => ({
  playerId: 'player-1',
  strategyId: 'strategy-1',
  score: 0.46,
  value: 46.54,
  appliedPosition: null,
  ...overrides,
});

describe('PlayerValuationResponseDto', () => {
  it('redondea el valor a 2 decimales, como el precio de una orden', () => {
    const dto = PlayerValuationResponseDto.fromResult(result({ value: 46.53999999999999 }));

    expect(dto.value).toBe(46.54);
  });

  it('redondea el score a 6 decimales, como una cotización persistida', () => {
    const dto = PlayerValuationResponseDto.fromResult(result({ score: 0.46000000000000002 + 0.0000004 }));

    expect(dto.score).toBe(0.460000);
  });

  it('no altera un valor que ya tiene la precisión esperada', () => {
    const dto = PlayerValuationResponseDto.fromResult(result({ score: 0.123456, value: 13.22 }));

    expect(dto.score).toBe(0.123456);
    expect(dto.value).toBe(13.22);
  });

  it('copia el resto de los campos sin cambios', () => {
    const dto = PlayerValuationResponseDto.fromResult(result({ appliedPosition: Position.GK }));

    expect(dto.playerId).toBe('player-1');
    expect(dto.strategyId).toBe('strategy-1');
    expect(dto.appliedPosition).toBe(Position.GK);
  });
});
