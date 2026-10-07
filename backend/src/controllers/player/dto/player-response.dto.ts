import { ApiProperty } from '@nestjs/swagger';
import { Player } from '../../../domain/player/player';

export class PlayerResponseDto {
  @ApiProperty({ example: 'b3f1c2a4-1234-4a4a-8a8a-abcdef123456' })
  id: string;

  @ApiProperty({ example: 'Iker Salazar' })
  name: string;

  @ApiProperty({ example: 'La Liga' })
  league: string;

  @ApiProperty({ example: 'CD Montebravo' })
  team: string;

  @ApiProperty({ example: 'GK' })
  position: string;

  @ApiProperty({
    example: 8.4,
    nullable: true,
    description:
      'Promedio por partido de la temporada en curso; null si no hay valor disponible.',
  })
  passesCompleted: number | null;

  @ApiProperty({ example: 3.9, nullable: true })
  shots: number | null;

  @ApiProperty({ example: 0.2, nullable: true })
  interceptions: number | null;

  @ApiProperty({ example: 7.31, nullable: true })
  rating: number | null;

  @ApiProperty({
    example: 'https://crests.football-data.org/65.png',
    nullable: true,
    description: 'URL del escudo del equipo; null si no se pudo resolver el cruce con Football-Data.',
  })
  crestUrl: string | null;

  @ApiProperty({ example: 12, nullable: true, description: 'Goles totales en la temporada en curso; null si no hay valor disponible.' })
  goals: number | null;

  @ApiProperty({ example: 5, nullable: true, description: 'Asistencias totales en la temporada en curso; null si no hay valor disponible.' })
  assists: number | null;

  @ApiProperty({ example: 25, nullable: true, description: 'Pases clave totales en la temporada en curso; null si no hay valor disponible.' })
  keyPasses: number | null;

  @ApiProperty({ example: 14, nullable: true, description: 'Regates exitosos totales en la temporada en curso; null si no hay valor disponible.' })
  dribbles: number | null;

  @ApiProperty({ example: 8, nullable: true, description: 'Entradas totales en la temporada en curso; null si no hay valor disponible.' })
  totalTackles: number | null;

  @ApiProperty({ example: 2, nullable: true, description: 'Tarjetas amarillas totales en la temporada en curso; null si no hay valor disponible.' })
  yellowCards: number | null;

  @ApiProperty({ example: 0, nullable: true, description: 'Tarjetas rojas totales en la temporada en curso; null si no hay valor disponible.' })
  redCards: number | null;

  private constructor(props: {
    id: string;
    name: string;
    league: string;
    team: string;
    position: string;
    passesCompleted: number | null;
    shots: number | null;
    interceptions: number | null;
    rating: number | null;
    crestUrl: string | null;
    goals: number | null;
    assists: number | null;
    keyPasses: number | null;
    dribbles: number | null;
    totalTackles: number | null;
    yellowCards: number | null;
    redCards: number | null;
  }) {
    this.id = props.id;
    this.name = props.name;
    this.league = props.league;
    this.team = props.team;
    this.position = props.position;
    this.passesCompleted = props.passesCompleted;
    this.shots = props.shots;
    this.interceptions = props.interceptions;
    this.rating = props.rating;
    this.crestUrl = props.crestUrl;
    this.goals = props.goals;
    this.assists = props.assists;
    this.keyPasses = props.keyPasses;
    this.dribbles = props.dribbles;
    this.totalTackles = props.totalTackles;
    this.yellowCards = props.yellowCards;
    this.redCards = props.redCards;
  }

  static fromDomain(player: Player, crestUrl: string | null = null): PlayerResponseDto {
    return new PlayerResponseDto({
      id: player.id,
      name: player.name,
      league: player.league,
      team: player.team,
      position: player.position,
      passesCompleted: player.passesCompleted,
      shots: player.shots,
      interceptions: player.interceptions,
      rating: player.rating,
      crestUrl,
      goals: player.goals,
      assists: player.assists,
      keyPasses: player.keyPasses,
      dribbles: player.dribbles,
      totalTackles: player.totalTackles,
      yellowCards: player.yellowCards,
      redCards: player.redCards,
    });
  }
}
