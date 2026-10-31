import { Logger } from '@nestjs/common';
import { Standing } from '../../domain/competition/standing';
import { TeamNameException } from '../../domain/competition/team-name-exception';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { StandingRepository } from '../../repositories/competition/standing.repository';
import { TeamNameExceptionRepository } from '../../repositories/competition/team-name-exception.repository';
import { TeamRepository } from '../../repositories/competition/team.repository';
import { TeamCrosswalkSyncService } from './team-crosswalk-sync.service';

const makeStanding = (externalTeamId: number, teamName: string, crestUrl: string | null = null): Standing =>
  Standing.restore(`uuid-${externalTeamId}`, {
    externalTeamId,
    teamName,
    leagueCode: 'PL',
    season: 2026,
    position: 1,
    playedGames: 10,
    won: 7,
    draw: 2,
    lost: 1,
    points: 23,
    goalsFor: 20,
    goalsAgainst: 8,
    goalDifference: 12,
    form: null,
    crestUrl,
  });

describe('TeamCrosswalkSyncService', () => {
  let players: jest.Mocked<PlayerRepository>;
  let standings: jest.Mocked<StandingRepository>;
  let exceptions: jest.Mocked<TeamNameExceptionRepository>;
  let teams: jest.Mocked<TeamRepository>;
  let service: TeamCrosswalkSyncService;

  beforeEach(() => {
    players = { findActiveTeamNames: jest.fn() } as unknown as jest.Mocked<PlayerRepository>;
    standings = { findAll: jest.fn() } as unknown as jest.Mocked<StandingRepository>;
    exceptions = { findAll: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<TeamNameExceptionRepository>;
    teams = { upsertTeams: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<TeamRepository>;
    service = new TeamCrosswalkSyncService(players, standings, exceptions, teams);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('resuelve por normalizacion y guarda el equipo con su escudo', async () => {
    players.findActiveTeamNames.mockResolvedValue(['Arsenal']);
    standings.findAll.mockResolvedValue([makeStanding(57, 'Arsenal FC', 'https://crests/57.png')]);

    const summary = await service.sync();

    expect(summary).toEqual({ resolved: 1, unresolved: [] });
    const [saved] = teams.upsertTeams.mock.calls[0][0];
    expect(saved.whoScoredName).toBe('Arsenal');
    expect(saved.footballDataTeamId).toBe(57);
    expect(saved.crestUrl).toBe('https://crests/57.png');
  });

  it('resuelve por excepcion cuando la normalizacion no alcanza', async () => {
    players.findActiveTeamNames.mockResolvedValue(['Manchester Utd']);
    standings.findAll.mockResolvedValue([makeStanding(66, 'Manchester United FC')]);
    exceptions.findAll.mockResolvedValue([
      TeamNameException.restore('exc-1', {
        whoScoredRawName: 'Manchester Utd',
        footballDataTeamId: 66,
        footballDataTeamName: 'Manchester United FC',
        leagueCode: 'PL',
      }),
    ]);

    const summary = await service.sync();

    expect(summary.resolved).toBe(1);
    expect(teams.upsertTeams.mock.calls[0][0][0].footballDataTeamId).toBe(66);
  });

  it('informa los equipos sin resolver y guarda solo los resueltos', async () => {
    players.findActiveTeamNames.mockResolvedValue(['Arsenal', 'Equipo Raro']);
    standings.findAll.mockResolvedValue([makeStanding(57, 'Arsenal FC')]);

    const summary = await service.sync();

    expect(summary).toEqual({ resolved: 1, unresolved: ['Equipo Raro'] });
    expect(teams.upsertTeams.mock.calls[0][0]).toHaveLength(1);
  });

  it('el cron no propaga un error inesperado y libera el lock', async () => {
    players.findActiveTeamNames.mockRejectedValueOnce(new Error('db caida'));

    await expect(service.handleCron()).resolves.toBeUndefined();

    players.findActiveTeamNames.mockResolvedValue([]);
    standings.findAll.mockResolvedValue([]);
    await service.handleCron();
    expect(teams.upsertTeams).toHaveBeenCalledTimes(1);
  });
});
