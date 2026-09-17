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

  private constructor(
    id: string,
    name: string,
    league: string,
    team: string,
    position: string,
  ) {
    this.id = id;
    this.name = name;
    this.league = league;
    this.team = team;
    this.position = position;
  }

  static fromDomain(player: Player): PlayerResponseDto {
    return new PlayerResponseDto(
      player.id,
      player.name,
      player.league,
      player.team,
      player.position,
    );
  }
}
