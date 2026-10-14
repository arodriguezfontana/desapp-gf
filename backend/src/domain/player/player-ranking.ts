import { Player } from './player';

/**
 * Item de dominio que asocia a un futbolista con su cotización más reciente.
 * Producido por el repositorio al resolver el ranking.
 */
export interface RankedPlayerQuote {
  player: Player;
  valor: number;
  score: number;
  strategyName: string;
  calculatedAt: Date;
}

/**
 * Página devuelta por el puerto de persistencia PlayerRepository.findRanking.
 */
export interface PlayerRankingPage {
  items: RankedPlayerQuote[];
  total: number;
}

/**
 * Item de dominio enriquecido en la capa de servicios con el escudo oficial
 * y la posición ordinal correlativa (rank 1..N).
 */
export interface RankedPlayerWithCrest {
  player: Player;
  crestUrl: string | null;
  rank: number;
  valor: number;
  score: number;
  strategyName: string;
  calculatedAt: Date;
}

/**
 * Página enriquecida con escudos y posiciones rank lista para presentar al controller.
 */
export interface PlayerRankingPageWithCrests {
  items: RankedPlayerWithCrest[];
  total: number;
}

