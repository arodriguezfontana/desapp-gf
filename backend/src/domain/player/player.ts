import { League } from './league';
import { Position } from './position';

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
  ) {}

  static restore(
    id: string,
    name: string,
    league: League,
    team: string,
    position: Position,
  ): Player {
    return new Player(id, name, league, team, position);
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
}
