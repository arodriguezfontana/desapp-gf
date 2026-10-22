import { ApiProperty } from '@nestjs/swagger';

/** Cotización vigente de un jugador cargada por la simulación, para mostrar valores sin pedir el detalle del jugador aparte. */
export class SimulatedQuoteDto {
  @ApiProperty({ example: 'f3b1c2a0-...' })
  playerId!: string;

  @ApiProperty({ example: 'Emiliano Martínez' })
  playerName!: string;

  @ApiProperty({ example: 24.5 })
  value!: number;
}

/**
 * Resumen devuelto tras ejecutar la simulación de mercado y actividad interactiva.
 */
export class SimulationResultDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Simulación completada con éxito para la cuenta de administrador.' })
  message!: string;

  @ApiProperty({ example: 'abi_admin@ejemplo.com' })
  adminEmail!: string;

  @ApiProperty({ example: 5 })
  holdingsCreated!: number;

  @ApiProperty({ example: 12 })
  transactionsCreated!: number;

  @ApiProperty({ example: 4 })
  ordersCreated!: number;

  @ApiProperty({ example: 36 })
  marketOrdersCreated!: number;

  @ApiProperty({ example: 30 })
  quotesCreated!: number;

  @ApiProperty({ example: ['Emiliano Martínez', 'Wesley Fofana', 'Moisés Caicedo'] })
  playersInvolved!: string[];

  @ApiProperty({ type: [SimulatedQuoteDto], description: 'Cotización más reciente cargada por jugador simulado' })
  quotes!: SimulatedQuoteDto[];
}

