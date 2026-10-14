import { ApiProperty } from '@nestjs/swagger';
import { RankedPlayerWithCrest } from '../../../domain/player/player-ranking';

export class PlayerRankingResponseDto {
  @ApiProperty({
    example: 1,
    description: 'Posición ordinal en el ranking (1..N) considerando paginación.',
  })
  rank: number;

  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  id: string;

  @ApiProperty({ example: 'Kylian Mbappé' })
  name: string;

  @ApiProperty({ example: 'La Liga' })
  league: string;

  @ApiProperty({ example: 'Real Madrid' })
  team: string;

  @ApiProperty({ example: 'FW' })
  position: string;

  @ApiProperty({
    example: 'https://crests.football-data.org/86.png',
    nullable: true,
    description:
      'URL del escudo del equipo; null si no se pudo resolver el cruce con Football-Data.',
  })
  crestUrl: string | null;

  @ApiProperty({
    example: 450.0,
    description:
      'Cotización vigente del jugador calculada bajo la estrategia vigente o más reciente.',
  })
  valor: number;

  @ApiProperty({
    example: 0.92345,
    description: 'Score normalizado de rendimiento.',
  })
  score: number;

  @ApiProperty({
    example: 'Estrategia Balanceada v1',
    description: 'Nombre de la estrategia de valoración que generó el quote.',
  })
  strategyName: string;

  @ApiProperty({
    example: 18,
    nullable: true,
    description:
      'Partidos jugados en la temporada en curso (titularidades + sustituciones); null si no hay valor disponible.',
  })
  matchesPlayed: number | null;

  @ApiProperty({
    example: 28.5,
    nullable: true,
    description:
      'Promedio por partido de la temporada en curso; null si no hay valor disponible.',
  })
  passesCompleted: number | null;

  @ApiProperty({ example: 4.1, nullable: true })
  shots: number | null;

  @ApiProperty({ example: 0.3, nullable: true })
  interceptions: number | null;

  @ApiProperty({ example: 8.24, nullable: true })
  rating: number | null;

  @ApiProperty({
    example: 16,
    nullable: true,
    description:
      'Goles totales en la temporada en curso; null si no hay valor disponible.',
  })
  goals: number | null;

  @ApiProperty({
    example: 5,
    nullable: true,
    description:
      'Asistencias totales en la temporada en curso; null si no hay valor disponible.',
  })
  assists: number | null;

  @ApiProperty({
    example: 24,
    nullable: true,
    description:
      'Pases clave totales en la temporada en curso; null si no hay valor disponible.',
  })
  keyPasses: number | null;

  @ApiProperty({
    example: 38,
    nullable: true,
    description:
      'Regates exitosos totales en la temporada en curso; null si no hay valor disponible.',
  })
  dribbles: number | null;

  @ApiProperty({
    example: 6,
    nullable: true,
    description:
      'Entradas totales en la temporada en curso; null si no hay valor disponible.',
  })
  totalTackles: number | null;

  @ApiProperty({
    example: 1,
    nullable: true,
    description:
      'Tarjetas amarillas totales en la temporada en curso; null si no hay valor disponible.',
  })
  yellowCards: number | null;

  @ApiProperty({
    example: 0,
    nullable: true,
    description:
      'Tarjetas rojas totales en la temporada en curso; null si no hay valor disponible.',
  })
  redCards: number | null;

  private constructor(props: {
    rank: number;
    id: string;
    name: string;
    league: string;
    team: string;
    position: string;
    crestUrl: string | null;
    valor: number;
    score: number;
    strategyName: string;
    matchesPlayed: number | null;
    passesCompleted: number | null;
    shots: number | null;
    interceptions: number | null;
    rating: number | null;
    goals: number | null;
    assists: number | null;
    keyPasses: number | null;
    dribbles: number | null;
    totalTackles: number | null;
    yellowCards: number | null;
    redCards: number | null;
  }) {
    this.rank = props.rank;
    this.id = props.id;
    this.name = props.name;
    this.league = props.league;
    this.team = props.team;
    this.position = props.position;
    this.crestUrl = props.crestUrl;
    this.valor = props.valor;
    this.score = props.score;
    this.strategyName = props.strategyName;
    this.matchesPlayed = props.matchesPlayed;
    this.passesCompleted = props.passesCompleted;
    this.shots = props.shots;
    this.interceptions = props.interceptions;
    this.rating = props.rating;
    this.goals = props.goals;
    this.assists = props.assists;
    this.keyPasses = props.keyPasses;
    this.dribbles = props.dribbles;
    this.totalTackles = props.totalTackles;
    this.yellowCards = props.yellowCards;
    this.redCards = props.redCards;
  }

  static fromRankedPlayerWithCrest(
    item: RankedPlayerWithCrest,
  ): PlayerRankingResponseDto {
    return new PlayerRankingResponseDto({
      rank: item.rank,
      id: item.player.id,
      name: item.player.name,
      league: item.player.league,
      team: item.player.team,
      position: item.player.position,
      crestUrl: item.crestUrl,
      valor: item.valor,
      score: item.score,
      strategyName: item.strategyName,
      matchesPlayed: item.player.matchesPlayed,
      passesCompleted: item.player.passesCompleted,
      shots: item.player.shots,
      interceptions: item.player.interceptions,
      rating: item.player.rating,
      goals: item.player.goals,
      assists: item.player.assists,
      keyPasses: item.player.keyPasses,
      dribbles: item.player.dribbles,
      totalTackles: item.player.totalTackles,
      yellowCards: item.player.yellowCards,
      redCards: item.player.redCards,
    });
  }
}

