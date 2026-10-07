export interface TeamProps {
  whoScoredName: string;
  footballDataTeamId: number;
  footballDataTeamName: string;
  leagueCode: string;
  crestUrl: string | null;
}

export class Team {
  private constructor(
    private readonly _id: string | null,
    private readonly _whoScoredName: string,
    private readonly _footballDataTeamId: number,
    private readonly _footballDataTeamName: string,
    private readonly _leagueCode: string,
    private readonly _crestUrl: string | null,
  ) {}

  static create(props: TeamProps): Team {
    return new Team(
      null,
      props.whoScoredName,
      props.footballDataTeamId,
      props.footballDataTeamName,
      props.leagueCode,
      props.crestUrl,
    );
  }

  static restore(id: string, props: TeamProps): Team {
    return new Team(
      id,
      props.whoScoredName,
      props.footballDataTeamId,
      props.footballDataTeamName,
      props.leagueCode,
      props.crestUrl,
    );
  }

  get id(): string | null { return this._id; }
  get whoScoredName(): string { return this._whoScoredName; }
  get footballDataTeamId(): number { return this._footballDataTeamId; }
  get footballDataTeamName(): string { return this._footballDataTeamName; }
  get leagueCode(): string { return this._leagueCode; }
  get crestUrl(): string | null { return this._crestUrl; }
}
