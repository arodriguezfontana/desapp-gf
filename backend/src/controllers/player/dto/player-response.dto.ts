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
  }

  static fromDomain(player: Player): PlayerResponseDto {
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
    });
  }
}
