import { Injectable } from '@nestjs/common';
import { Player } from '../../domain/player/player';
import { parseLeague } from '../../domain/player/league';
import { parsePosition } from '../../domain/player/position';
import { PlayerEntity } from '../entities/player.entity';

/** Conversion dominio <-> persistencia. Sin logica de negocio. */
@Injectable()
export class PlayerMapper {
  toDomain(entity: PlayerEntity): Player {
    return Player.restore(
      entity.id,
      entity.name,
      parseLeague(entity.league),
      entity.team,
      parsePosition(entity.position),
    );
  }

  toEntity(player: Player): PlayerEntity {
    const entity = new PlayerEntity();
    entity.id = player.id;
    entity.name = player.name;
    entity.league = player.league;
    entity.team = player.team;
    entity.position = player.position;
    return entity;
  }
}
