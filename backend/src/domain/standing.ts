export interface StandingProps {
  externalTeamId: number;
  teamName: string;
  leagueCode: string;
  season: number;
  position: number;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: string | null;
  crestUrl: string | null;
}

/**
 * Entidad de dominio. Sin decoradores de TypeORM ni conocimiento de NestJS, HTTP o
 * base de datos (constitución, Principio I).
 */
export class Standing {
  private constructor(
    private readonly _id: string | null,
    private readonly _externalTeamId: number,
    private readonly _teamName: string,
    private readonly _leagueCode: string,
    private readonly _season: number,
    private readonly _position: number,
    private readonly _playedGames: number,
    private readonly _won: number,
    private readonly _draw: number,
    private readonly _lost: number,
    private readonly _points: number,
    private readonly _goalsFor: number,
    private readonly _goalsAgainst: number,
    private readonly _goalDifference: number,
    private readonly _form: string | null,
    private readonly _crestUrl: string | null,
  ) {}

  /** Posición recién sincronizada, todavía sin id de persistencia. */
  static create(props: StandingProps): Standing {
    return new Standing(
      null,
      props.externalTeamId,
      props.teamName,
      props.leagueCode,
      props.season,
      props.position,
      props.playedGames,
      props.won,
      props.draw,
      props.lost,
      props.points,
      props.goalsFor,
      props.goalsAgainst,
      props.goalDifference,
      props.form,
      props.crestUrl,
    );
  }

  /** Reconstrucción desde persistencia, con id ya asignado. */
  static restore(id: string, props: StandingProps): Standing {
    return new Standing(
      id,
      props.externalTeamId,
      props.teamName,
      props.leagueCode,
      props.season,
      props.position,
      props.playedGames,
      props.won,
      props.draw,
      props.lost,
      props.points,
      props.goalsFor,
      props.goalsAgainst,
      props.goalDifference,
      props.form,
      props.crestUrl,
    );
  }

  get id(): string | null {
    return this._id;
  }

  get externalTeamId(): number {
    return this._externalTeamId;
  }

  get teamName(): string {
    return this._teamName;
  }

  get leagueCode(): string {
    return this._leagueCode;
  }

  get season(): number {
    return this._season;
  }

  get position(): number {
    return this._position;
  }

  get playedGames(): number {
    return this._playedGames;
  }

  get won(): number {
    return this._won;
  }

  get draw(): number {
    return this._draw;
  }

  get lost(): number {
    return this._lost;
  }

  get points(): number {
    return this._points;
  }

  get goalsFor(): number {
    return this._goalsFor;
  }

  get goalsAgainst(): number {
    return this._goalsAgainst;
  }

  get goalDifference(): number {
    return this._goalDifference;
  }

  /** Racha de últimos partidos (p.ej. `WWDLW`); no se usa aún en ninguna lógica, sólo se persiste. */
  get form(): string | null {
    return this._form;
  }

  get crestUrl(): string | null {
    return this._crestUrl;
  }
}
