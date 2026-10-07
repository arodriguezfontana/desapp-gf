import { League } from './enums/league';
import { Position } from './enums/position';

/**
 * Entidad de dominio. Sin decoradores de TypeORM ni conocimiento de NestJS, HTTP o
 * base de datos (constitución, Principio I). El catálogo es de sólo lectura vía API
 * (FR-015): no existe un factory de alta, sólo reconstrucción desde persistencia.
 */
export class Player {
  private constructor(
    private readonly _id: string,
    private readonly _name: string,
    private readonly _league: League,
    private readonly _team: string,
    private readonly _position: Position,
    private readonly _passesCompleted: number | null,
    private readonly _shots: number | null,
    private readonly _interceptions: number | null,
    private readonly _rating: number | null,
    private readonly _goals: number | null,
    private readonly _assists: number | null,
    private readonly _keyPasses: number | null,
    private readonly _dribbles: number | null,
    private readonly _totalTackles: number | null,
    private readonly _yellowCards: number | null,
    private readonly _redCards: number | null,
  ) {}

  static restore(props: {
    id: string;
    name: string;
    league: League;
    team: string;
    position: Position;
    passesCompleted: number | null;
    shots: number | null;
    interceptions: number | null;
    rating: number | null;
    goals?: number | null;
    assists?: number | null;
    keyPasses?: number | null;
    dribbles?: number | null;
    totalTackles?: number | null;
    yellowCards?: number | null;
    redCards?: number | null;
  }): Player {
    return new Player(
      props.id,
      props.name,
      props.league,
      props.team,
      props.position,
      props.passesCompleted,
      props.shots,
      props.interceptions,
      props.rating,
      props.goals ?? null,
      props.assists ?? null,
      props.keyPasses ?? null,
      props.dribbles ?? null,
      props.totalTackles ?? null,
      props.yellowCards ?? null,
      props.redCards ?? null,
    );
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get league(): League {
    return this._league;
  }

  get team(): string {
    return this._team;
  }

  get position(): Position {
    return this._position;
  }

  /** Promedio por partido de la temporada en curso; `null` si no hay valor disponible. */
  get passesCompleted(): number | null {
    return this._passesCompleted;
  }

  get shots(): number | null {
    return this._shots;
  }

  get interceptions(): number | null {
    return this._interceptions;
  }

  get rating(): number | null {
    return this._rating;
  }

  get goals(): number | null {
    return this._goals;
  }

  get assists(): number | null {
    return this._assists;
  }

  get keyPasses(): number | null {
    return this._keyPasses;
  }

  get dribbles(): number | null {
    return this._dribbles;
  }

  get totalTackles(): number | null {
    return this._totalTackles;
  }

  get yellowCards(): number | null {
    return this._yellowCards;
  }

  get redCards(): number | null {
    return this._redCards;
  }
}
