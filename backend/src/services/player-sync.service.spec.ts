import { Logger } from '@nestjs/common';
import { PlayerSyncService } from './player-sync.service';
import {
  WhoScoredAdapter,
  WhoScoredLeagueTeams,
  WhoScoredRawPlayer,
  WhoScoredTeamRef,
} from '../adapters/whoscored-adapter';
import { PlayerRepository } from '../repositories/player.repository';
import { League } from '../domain/player/league';
import { Position } from '../domain/player/position';

const rawPlayer = (
  overrides: Partial<WhoScoredRawPlayer> = {},
): WhoScoredRawPlayer => ({
  externalId: 'ws-1',
  name: 'Jugador',
  rawPosition: 'GK',
  metrics: { passesCompleted: 10, shots: 1, interceptions: 0.5, rating: 7 },
  metricsFetchFailed: false,
  ...overrides,
});

const DEFAULT_TOURNAMENT_ID = 2;

/**
 * Arma el resultado de `fetchLeagueTeams` (research.md §1 de
 * 006-whoscored-catalog-sync: `tournamentId` y el jugador semilla de cada
 * equipo viajan en el valor de retorno, no en un campo del Adapter). Por
 * default arma un jugador semilla `seed-<externalTeamId>` por cada equipo,
 * para que el nuevo chequeo de "sin jugador semilla" de `syncTeam` no salga
 * a mitad de camino en los tests que no están probando específicamente ese
 * caso.
 */
function leagueTeamsResult(
  teams: WhoScoredTeamRef[],
  options: { tournamentId?: number; seedPlayerByTeam?: Map<string, string> } = {},
): WhoScoredLeagueTeams {
  return {
    tournamentId: options.tournamentId ?? DEFAULT_TOURNAMENT_ID,
    teams,
    seedPlayerByTeam:
      options.seedPlayerByTeam ??
      new Map(teams.map((t) => [t.externalTeamId, `seed-${t.externalTeamId}`])),
  };
}

describe('PlayerSyncService', () => {
  let whoScored: jest.Mocked<WhoScoredAdapter>;
  let players: jest.Mocked<PlayerRepository>;
  let service: PlayerSyncService;

  beforeEach(() => {
    whoScored = { fetchLeagueTeams: jest.fn(), fetchTeamRoster: jest.fn() };
    players = {
      findPage: jest.fn(),
      findById: jest.fn(),
      findActiveExternalIdsByTeam: jest.fn().mockResolvedValue([]),
      applyTeamRosterSync: jest.fn().mockResolvedValue(undefined),
    };
    service = new PlayerSyncService(whoScored, players);
  });

  it('sincroniza cada equipo de cada liga con éxito: upsert correcto por equipo', async () => {
    whoScored.fetchLeagueTeams.mockImplementation((league) =>
      Promise.resolve(
        leagueTeamsResult(
          league === League.PREMIER_LEAGUE
            ? [{ externalTeamId: 't1', team: 'Equipo Uno' }]
            : [],
        ),
      ),
    );
    whoScored.fetchTeamRoster.mockResolvedValue([
      rawPlayer({ externalId: 'ws-1', rawPosition: 'GK' }),
    ]);

    await service.sync();

    expect(whoScored.fetchTeamRoster).toHaveBeenCalledWith(
      { externalTeamId: 't1', team: 'Equipo Uno' },
      DEFAULT_TOURNAMENT_ID,
      'seed-t1',
    );
    expect(players.findActiveExternalIdsByTeam).toHaveBeenCalledWith(
      League.PREMIER_LEAGUE,
      'Equipo Uno',
    );
    expect(players.applyTeamRosterSync).toHaveBeenCalledWith(
      League.PREMIER_LEAGUE,
      'Equipo Uno',
      [
        {
          externalId: 'ws-1',
          name: 'Jugador',
          position: Position.GK,
          metrics: { passesCompleted: 10, shots: 1, interceptions: 0.5, rating: 7 },
        },
      ],
      [],
    );
  });

  it('una liga que falla no afecta a las demás (FR-014 nivel liga)', async () => {
    whoScored.fetchLeagueTeams.mockImplementation((league) => {
      if (league === League.PREMIER_LEAGUE) {
        return Promise.reject(new Error('WhoScored caído'));
      }
      return Promise.resolve(
        leagueTeamsResult([{ externalTeamId: 't2', team: 'Equipo Dos' }]),
      );
    });
    whoScored.fetchTeamRoster.mockResolvedValue([rawPlayer()]);

    await expect(service.sync()).resolves.toBeUndefined();

    // Se llamó fetchTeamRoster para las otras 4 ligas (Premier League falló antes de eso).
    expect(whoScored.fetchTeamRoster).toHaveBeenCalledTimes(4);
    expect(players.applyTeamRosterSync).toHaveBeenCalledTimes(4);
  });

  it('un equipo que falla no afecta a los demás equipos de su liga (FR-014 nivel equipo)', async () => {
    whoScored.fetchLeagueTeams.mockImplementation((league) =>
      Promise.resolve(
        leagueTeamsResult(
          league === League.PREMIER_LEAGUE
            ? [
                { externalTeamId: 'falla', team: 'Equipo Falla' },
                { externalTeamId: 'ok', team: 'Equipo OK' },
              ]
            : [],
        ),
      ),
    );
    whoScored.fetchTeamRoster.mockImplementation((team) =>
      team.externalTeamId === 'falla'
        ? Promise.reject(new Error('plantel caído'))
        : Promise.resolve([rawPlayer()]),
    );

    await service.sync();

    expect(players.applyTeamRosterSync).toHaveBeenCalledTimes(1);
    expect(players.applyTeamRosterSync).toHaveBeenCalledWith(
      League.PREMIER_LEAGUE,
      'Equipo OK',
      expect.any(Array),
      expect.any(Array),
    );
  });

  it('si fetchTeamRoster lanza porque el plantel vino vacío (selector del Adapter no matchea nada), no se llama a applyTeamRosterSync para ese equipo y no se toca su roster anterior', async () => {
    whoScored.fetchLeagueTeams.mockImplementation((league) =>
      Promise.resolve(
        leagueTeamsResult(
          league === League.PREMIER_LEAGUE
            ? [{ externalTeamId: 't1', team: 'Equipo Uno' }]
            : [],
        ),
      ),
    );
    whoScored.fetchTeamRoster.mockRejectedValue(
      new Error(
        'El plantel de Equipo Uno (t1) vino vacío al parsear la página del jugador semilla seed-t1; probablemente cambió la estructura de la página.',
      ),
    );

    await expect(service.sync()).resolves.toBeUndefined();

    expect(players.findActiveExternalIdsByTeam).not.toHaveBeenCalled();
    expect(players.applyTeamRosterSync).not.toHaveBeenCalled();
  });

  it('si no hay un jugador semilla conocido para un equipo (según el mapa de esa liga), no llama a fetchTeamRoster ni a applyTeamRosterSync para ese equipo', async () => {
    whoScored.fetchLeagueTeams.mockImplementation((league) =>
      Promise.resolve(
        leagueTeamsResult(
          league === League.PREMIER_LEAGUE
            ? [
                { externalTeamId: 'sin-semilla', team: 'Equipo Sin Semilla' },
                { externalTeamId: 'con-semilla', team: 'Equipo Con Semilla' },
              ]
            : [],
          {
            // Sólo 'con-semilla' tiene jugador semilla en el mapa de esta liga.
            seedPlayerByTeam: new Map([['con-semilla', 'seed-1']]),
          },
        ),
      ),
    );
    whoScored.fetchTeamRoster.mockResolvedValue([rawPlayer()]);

    await service.sync();

    expect(whoScored.fetchTeamRoster).not.toHaveBeenCalledWith(
      expect.objectContaining({ externalTeamId: 'sin-semilla' }),
      expect.anything(),
      expect.anything(),
    );
    expect(whoScored.fetchTeamRoster).toHaveBeenCalledTimes(1);
    expect(players.applyTeamRosterSync).toHaveBeenCalledTimes(1);
    expect(players.applyTeamRosterSync).toHaveBeenCalledWith(
      League.PREMIER_LEAGUE,
      'Equipo Con Semilla',
      expect.any(Array),
      expect.any(Array),
    );
  });

  it('calcula las bajas combinando los activos previos con los entrantes (computePlayersToRemove)', async () => {
    whoScored.fetchLeagueTeams.mockImplementation((league) =>
      Promise.resolve(
        leagueTeamsResult(
          league === League.PREMIER_LEAGUE
            ? [{ externalTeamId: 't1', team: 'Equipo Uno' }]
            : [],
        ),
      ),
    );
    players.findActiveExternalIdsByTeam.mockResolvedValue(['ws-1', 'ws-viejo']);
    whoScored.fetchTeamRoster.mockResolvedValue([rawPlayer({ externalId: 'ws-1' })]);

    await service.sync();

    expect(players.applyTeamRosterSync).toHaveBeenCalledWith(
      League.PREMIER_LEAGUE,
      'Equipo Uno',
      expect.any(Array),
      ['ws-viejo'],
    );
  });

  describe('mapeo de posición y revisión manual (User Story 3)', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      whoScored.fetchLeagueTeams.mockImplementation((league) =>
        Promise.resolve(
          leagueTeamsResult(
            league === League.PREMIER_LEAGUE
              ? [{ externalTeamId: 't1', team: 'Equipo Uno' }]
              : [],
          ),
        ),
      );
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it.each([
      ['GK', Position.GK],
      ['DR', Position.DF],
      ['DMC', Position.MF],
      ['FW', Position.FW],
    ])('mapea el código %s a %s y lo incluye en el upsert', async (rawPosition, expected) => {
      whoScored.fetchTeamRoster.mockResolvedValue([
        rawPlayer({ externalId: 'ws-1', rawPosition: rawPosition as string }),
      ]);

      await service.sync();

      const upserts = players.applyTeamRosterSync.mock.calls[0][2];
      expect(upserts).toEqual([
        expect.objectContaining({ externalId: 'ws-1', position: expected }),
      ]);
    });

    it('un código de posición no reconocido no se persiste y genera un log distinto al de falla de stats, sin afectar al resto del equipo', async () => {
      whoScored.fetchTeamRoster.mockResolvedValue([
        rawPlayer({ externalId: 'ws-no-reconocido', rawPosition: 'SUB' }),
        rawPlayer({ externalId: 'ws-ok', rawPosition: 'GK' }),
      ]);

      await service.sync();

      const upserts = players.applyTeamRosterSync.mock.calls[0][2];
      expect(upserts).toHaveLength(1);
      expect(upserts[0].externalId).toBe('ws-ok');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'unrecognized-position',
          whoScoredPlayerId: 'ws-no-reconocido',
          rawPosition: 'SUB',
        }),
      );
      // No cuenta como falla del equipo: el equipo igual se sincroniza.
      expect(players.applyTeamRosterSync).toHaveBeenCalledTimes(1);
    });

    it('un jugador con metricsFetchFailed se importa con métricas null y genera su propio log, distinto del de posición no reconocida', async () => {
      whoScored.fetchTeamRoster.mockResolvedValue([
        rawPlayer({
          externalId: 'ws-sin-stats',
          rawPosition: 'GK',
          metrics: null,
          metricsFetchFailed: true,
        }),
      ]);

      await service.sync();

      const upserts = players.applyTeamRosterSync.mock.calls[0][2];
      expect(upserts).toEqual([
        expect.objectContaining({ externalId: 'ws-sin-stats', metrics: null }),
      ]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'stats-fetch-failed',
          whoScoredPlayerId: 'ws-sin-stats',
        }),
      );
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'unrecognized-position' }),
      );
    });

    it('un jugador con métricas null pero sin falla técnica no genera ninguna entrada de log', async () => {
      whoScored.fetchTeamRoster.mockResolvedValue([
        rawPlayer({
          externalId: 'ws-sin-partidos',
          rawPosition: 'GK',
          metrics: null,
          metricsFetchFailed: false,
        }),
      ]);

      await service.sync();

      expect(warnSpy).not.toHaveBeenCalled();
      const upserts = players.applyTeamRosterSync.mock.calls[0][2];
      expect(upserts[0].metrics).toBeNull();
    });
  });
});
