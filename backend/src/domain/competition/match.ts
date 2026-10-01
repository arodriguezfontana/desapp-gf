import { MatchClassificationType } from './match-status-classifier';

export interface MatchProps {
  externalId: number;
  leagueCode: string;
  season: number;
  matchday: number;
  utcDate: Date;
  status: string;
  classification: MatchClassificationType;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
}

/**
 * Entidad de dominio. Sin decoradores de TypeORM ni conocimiento de NestJS, HTTP o
 * base de datos (constitución, Principio I).
 */
export class Match {
  private constructor(
    private readonly _id: string | null,
    private readonly _externalId: number,
    private readonly _leagueCode: string,
    private readonly _season: number,
    private readonly _matchday: number,
    private readonly _utcDate: Date,
    private readonly _status: string,
    private readonly _classification: MatchClassificationType,
    private readonly _homeTeamId: number,
    private readonly _homeTeamName: string,
    private readonly _awayTeamId: number,
    private readonly _awayTeamName: string,
    private readonly _homeScore: number | null,
    private readonly _awayScore: number | null,
  ) {}

  /** Partido recién clasificado por el sincronizador, todavía sin id de persistencia. */
  static create(props: MatchProps): Match {
    return new Match(
      null,
      props.externalId,
      props.leagueCode,
      props.season,
      props.matchday,
      props.utcDate,
      props.status,
      props.classification,
      props.homeTeamId,
      props.homeTeamName,
      props.awayTeamId,
      props.awayTeamName,
      props.homeScore,
      props.awayScore,
    );
  }

  /** Reconstrucción desde persistencia, con id ya asignado. */
  static restore(id: string, props: MatchProps): Match {
    return new Match(
      id,
      props.externalId,
      props.leagueCode,
      props.season,
      props.matchday,
      props.utcDate,
      props.status,
      props.classification,
      props.homeTeamId,
      props.homeTeamName,
      props.awayTeamId,
      props.awayTeamName,
      props.homeScore,
      props.awayScore,
    );
  }

  get id(): string | null {
    return this._id;
  }

  get externalId(): number {
    return this._externalId;
  }

  get leagueCode(): string {
    return this._leagueCode;
  }

  get season(): number {
    return this._season;
  }

  get matchday(): number {
    return this._matchday;
  }

  get utcDate(): Date {
    return this._utcDate;
  }

  get status(): string {
    return this._status;
  }

  get classification(): MatchClassificationType {
    return this._classification;
  }

  get homeTeamId(): number {
    return this._homeTeamId;
  }

  get homeTeamName(): string {
    return this._homeTeamName;
  }

  get awayTeamId(): number {
    return this._awayTeamId;
  }

  get awayTeamName(): string {
    return this._awayTeamName;
  }

  get homeScore(): number | null {
    return this._homeScore;
  }

  get awayScore(): number | null {
    return this._awayScore;
  }
}
