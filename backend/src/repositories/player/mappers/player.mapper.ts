import { Injectable } from '@nestjs/common';
import { Player } from '../../../domain/player/player';
import { parseLeague } from '../../../domain/player/enums/league';
import { parsePosition } from '../../../domain/player/enums/position';
import { PlayerEntity } from '../entities/player.entity';

/** Conversion dominio <-> persistencia. Sin logica de negocio. */
@Injectable()
export class PlayerMapper {
  toDomain(entity: PlayerEntity): Player {
    return Player.restore({
      id: entity.id,
      name: entity.name,
      league: parseLeague(entity.league),
      team: entity.team,
      position: parsePosition(entity.position),
      passesCompleted: entity.passesCompleted,
      shots: entity.shots,
      interceptions: entity.interceptions,
      rating: entity.rating,
      goals: entity.goals,
      assists: entity.assists,
      keyPasses: entity.keyPasses,
      dribbles: entity.dribbles,
      totalTackles: entity.totalTackles,
      yellowCards: entity.yellowCards,
      redCards: entity.redCards,
    });
  }

  toEntity(player: Player): PlayerEntity {
    const entity = new PlayerEntity();
    entity.id = player.id;
    entity.name = player.name;
    entity.league = player.league;
    entity.team = player.team;
    entity.position = player.position;
    entity.passesCompleted = player.passesCompleted;
    entity.shots = player.shots;
    entity.interceptions = player.interceptions;
    entity.rating = player.rating;
    entity.goals = player.goals;
    entity.assists = player.assists;
    entity.keyPasses = player.keyPasses;
    entity.dribbles = player.dribbles;
    entity.totalTackles = player.totalTackles;
    entity.yellowCards = player.yellowCards;
    entity.redCards = player.redCards;
    return entity;
  }
}
