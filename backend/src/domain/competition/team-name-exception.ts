export interface TeamNameExceptionProps {
  whoScoredRawName: string;
  footballDataTeamId: number;
  footballDataTeamName: string;
  leagueCode: string;
}

export class TeamNameException {
  private constructor(
    private readonly _id: string | null,
    private readonly _whoScoredRawName: string,
    private readonly _footballDataTeamId: number,
    private readonly _footballDataTeamName: string,
    private readonly _leagueCode: string,
  ) {}

  static create(props: TeamNameExceptionProps): TeamNameException {
    return new TeamNameException(
      null,
      props.whoScoredRawName,
      props.footballDataTeamId,
      props.footballDataTeamName,
      props.leagueCode,
    );
  }

  static restore(id: string, props: TeamNameExceptionProps): TeamNameException {
    return new TeamNameException(
      id,
      props.whoScoredRawName,
      props.footballDataTeamId,
      props.footballDataTeamName,
      props.leagueCode,
    );
  }

  get id(): string | null {
    return this._id;
  }

  get whoScoredRawName(): string {
    return this._whoScoredRawName;
  }

  get footballDataTeamId(): number {
    return this._footballDataTeamId;
  }

  get footballDataTeamName(): string {
    return this._footballDataTeamName;
  }

  get leagueCode(): string {
    return this._leagueCode;
  }
}
