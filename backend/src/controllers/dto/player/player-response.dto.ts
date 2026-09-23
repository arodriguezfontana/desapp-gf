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

  private constructor(
    id: string,
    name: string,
    league: string,
    team: string,
    position: string,
    passesCompleted: number | null,
    shots: number | null,
    interceptions: number | null,
    rating: number | null,
  ) {
    this.id = id;
    this.name = name;
    this.league = league;
    this.team = team;
    this.position = position;
    this.passesCompleted = passesCompleted;
    this.shots = shots;
    this.interceptions = interceptions;
    this.rating = rating;
  }

  static fromDomain(player: Player): PlayerResponseDto {
    return new PlayerResponseDto(
      player.id,
      player.name,
      player.league,
      player.team,
      player.position,
      player.passesCompleted,
      player.shots,
      player.interceptions,
      player.rating,
    );
  }
}
