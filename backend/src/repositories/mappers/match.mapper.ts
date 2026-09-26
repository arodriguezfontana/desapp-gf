import { Injectable } from '@nestjs/common';
import { Match } from '../../domain/match';
import { MatchEntity } from '../entities/match.entity';

/** Conversion dominio <-> persistencia. Sin logica de negocio. */
@Injectable()
export class MatchMapper {
  toDomain(entity: MatchEntity): Match {
    return Match.restore(entity.id, {
      externalId: entity.externalId,
      leagueCode: entity.leagueCode,
      season: entity.season,
      matchday: entity.matchday,
      utcDate: entity.utcDate,
      status: entity.status,
      classification: entity.classification,
      homeTeamId: entity.homeTeamId,
      homeTeamName: entity.homeTeamName,
      awayTeamId: entity.awayTeamId,
      awayTeamName: entity.awayTeamName,
      homeScore: entity.homeScore,
      awayScore: entity.awayScore,
    });
  }

  toEntity(match: Match): Partial<MatchEntity> {
    return {
      externalId: match.externalId,
      leagueCode: match.leagueCode,
      season: match.season,
      matchday: match.matchday,
      utcDate: match.utcDate,
      status: match.status,
      classification: match.classification,
      homeTeamId: match.homeTeamId,
      homeTeamName: match.homeTeamName,
      awayTeamId: match.awayTeamId,
      awayTeamName: match.awayTeamName,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    };
  }
}
