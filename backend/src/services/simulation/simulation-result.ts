/** Cotización vigente de un jugador cargada por la simulación. */
export interface SimulatedQuote {
  playerId: string;
  playerName: string;
  value: number;
}

/**
 * Resumen que devuelve `MarketSimulationService.simulate()`. Es el resultado de la capa de Service; el
 * Controller lo expone con `SimulationResultDto`, que lo implementa. El Service no importa el DTO.
 */
export interface SimulationResult {
  success: boolean;
  message: string;
  adminEmail: string;
  holdingsCreated: number;
  transactionsCreated: number;
  ordersCreated: number;
  marketOrdersCreated: number;
  quotesCreated: number;
  playersInvolved: string[];
  /** Cotización más reciente cargada por jugador simulado. */
  quotes: SimulatedQuote[];
  /** Alertas de demo sembradas para el admin (sólo la primera vez que se corre la simulación). */
  alertsCreated: number;
}
