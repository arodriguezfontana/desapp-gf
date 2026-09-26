import { Injectable } from '@nestjs/common';
import { Standing } from '../../domain/standing';
import { StandingEntity } from '../entities/standing.entity';

/** Conversion dominio <-> persistencia. Sin logica de negocio. */
@Injectable()
export class StandingMapper {
  toDomain(entity: StandingEntity): Standing {
    return Standing.restore(entity.id, {
      externalTeamId: entity.externalTeamId,
      teamName: entity.teamName,
      leagueCode: entity.leagueCode,
      season: entity.season,
      position: entity.position,
      playedGames: entity.playedGames,
      won: entity.won,
      draw: entity.draw,
      lost: entity.lost,
      points: entity.points,
      goalsFor: entity.goalsFor,
      goalsAgainst: entity.goalsAgainst,
      goalDifference: entity.goalDifference,
      form: entity.form,
      crestUrl: entity.crestUrl,
    });
  }

  toEntity(standing: Standing): Partial<StandingEntity> {
    return {
      externalTeamId: standing.externalTeamId,
      teamName: standing.teamName,
      leagueCode: standing.leagueCode,
      season: standing.season,
      position: standing.position,
      playedGames: standing.playedGames,
      won: standing.won,
      draw: standing.draw,
      lost: standing.lost,
      points: standing.points,
      goalsFor: standing.goalsFor,
      goalsAgainst: standing.goalsAgainst,
      goalDifference: standing.goalDifference,
      form: standing.form,
      crestUrl: standing.crestUrl,
    };
  }
}
