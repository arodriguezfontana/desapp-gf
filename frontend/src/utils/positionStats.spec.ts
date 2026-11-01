import { describe, it, expect } from 'vitest';
import {
  formatStat,
  getPositionStats,
  getSecondaryStats,
  getStatValue,
  STAT_LABELS,
} from './positionStats';
import type { Player } from '../types/catalog.types';

describe('getPositionStats', () => {
  it.each([
    ['FW', ['goals', 'assists', 'shots']],
    ['MF', ['assists', 'keyPasses', 'dribbles']],
    ['DF', ['totalTackles', 'interceptions', 'rating']],
    ['GK', ['rating', 'passesCompleted', 'interceptions']],
  ])('devuelve las 3 estadísticas significativas de %s', (position, expected) => {
    expect(getPositionStats(position)).toEqual(expected);
  });

  it('usa goles, asistencias y amarillas para una posición desconocida', () => {
    expect(getPositionStats('XX')).toEqual(['goals', 'assists', 'yellowCards']);
  });

  it('todas las estadísticas devueltas tienen etiqueta corta y completa', () => {
    for (const position of ['FW', 'MF', 'DF', 'GK', 'XX']) {
      for (const key of getPositionStats(position)) {
        expect(STAT_LABELS[key].short).toBeTruthy();
        expect(STAT_LABELS[key].full).toBeTruthy();
      }
    }
  });
});

describe('getSecondaryStats', () => {
  it('excluye las estadísticas principales de la posición', () => {
    expect(getSecondaryStats('FW')).toEqual([
      'keyPasses',
      'dribbles',
      'totalTackles',
      'passesCompleted',
      'interceptions',
      'rating',
      'yellowCards',
      'redCards',
    ]);
  });

  it('conserva goles y asistencias para un arquero, que no los tiene entre las principales', () => {
    const secondary = getSecondaryStats('GK');
    expect(secondary).toContain('goals');
    expect(secondary).toContain('assists');
  });

  it('nunca repite una estadística principal y, junto con ellas, cubre las 11 estadísticas', () => {
    for (const position of ['FW', 'MF', 'DF', 'GK', 'XX']) {
      const main = getPositionStats(position);
      const secondary = getSecondaryStats(position);
      expect(secondary.some((key) => main.includes(key))).toBe(false);
      expect(main.length + secondary.length).toBe(11);
    }
  });
});

describe('getStatValue', () => {
  it('lee el campo del jugador que corresponde a la estadística', () => {
    const player = {
      id: 'p',
      name: 'X',
      league: 'La Liga',
      team: 'T',
      position: 'GK',
      rating: 7.2,
    } as Player;
    expect(getStatValue(player, 'rating')).toBe(7.2);
    expect(getStatValue(player, 'goals')).toBeUndefined();
  });
});

describe('formatStat', () => {
  it('muestra los enteros sin decimales', () => {
    expect(formatStat(27)).toBe('27');
    expect(formatStat(0)).toBe('0');
  });

  it('muestra los promedios con un decimal', () => {
    expect(formatStat(7.34)).toBe('7.3');
  });

  it('muestra "—" cuando no hay dato', () => {
    expect(formatStat(null)).toBe('—');
    expect(formatStat(undefined)).toBe('—');
  });
});
