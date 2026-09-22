import axios from 'axios';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HttpWhoScoredAdapter, normalizeRawPosition } from './http-whoscored-adapter';
import { League } from '../domain/player/league';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const FIXTURES_DIR = join(__dirname, '..', '..', 'test', 'fixtures', 'whoscored');
const LEAGUE_TEAMS_HTML = readFileSync(
  join(FIXTURES_DIR, 'league-teams.html'),
  'utf-8',
);
const PLAYER_MATCHSTATS_HTML = readFileSync(
  join(FIXTURES_DIR, 'player-matchstatistics.html'),
  'utf-8',
);

/** Fixture mínimo, no capturado (a diferencia de los dos de arriba): sólo
 * ejercita `harvestSeedPlayers`, que ya tiene su propio test de la función
 * genérica de extracción (`tournaments`) contra el fixture real. */
const PLAYER_STATISTICS_HTML = `
  <html><body>
    <a href="/regions/252/tournaments/2/seasons/11141/stages/25544/playerstatistics/x">stats</a>
    <script>
      require.config.params['args'] = {
        playerAssistData: [{"TeamId":32,"GSPlayerId":123761,"GAPlayerId":300713}],
      };
    </script>
  </body></html>
`;

function mockGetByUrl(handlers: Record<string, string | Error>): void {
  mockedAxios.get.mockImplementation((url: string) => {
    for (const [pattern, result] of Object.entries(handlers)) {
      if (url.includes(pattern)) {
        if (result instanceof Error) return Promise.reject(result);
        return Promise.resolve({ data: result });
      }
    }
    return Promise.reject(new Error(`URL no mockeada: ${url}`));
  });
}

describe('HttpWhoScoredAdapter', () => {
  let adapter: HttpWhoScoredAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new HttpWhoScoredAdapter();
  });

  describe('fetchLeagueTeams', () => {
    it('parsea los equipos reales de la liga desde el fixture capturado, sin duplicados', async () => {
      mockGetByUrl({
        playerstatistics: PLAYER_STATISTICS_HTML,
        '/regions/252/tournaments/2/': LEAGUE_TEAMS_HTML,
      });

      const teams = await adapter.fetchLeagueTeams(League.PREMIER_LEAGUE);

      expect(teams.length).toBeGreaterThan(0);
      const ids = teams.map((t) => t.externalTeamId);
      expect(new Set(ids).size).toBe(ids.length); // sin duplicados
      expect(teams).toContainEqual({
        externalTeamId: '32',
        team: 'Manchester United',
      });
    });

    it('propaga el error si no se puede obtener la página de la liga (FR-014 nivel liga)', async () => {
      mockedAxios.get.mockRejectedValue(new Error('timeout'));

      await expect(
        adapter.fetchLeagueTeams(League.PREMIER_LEAGUE),
      ).rejects.toThrow('timeout');
    });
  });

  describe('fetchTeamRoster', () => {
    it('lanza si no hay un jugador semilla conocido para ese equipo (equipo nunca sincronizado con éxito)', async () => {
      await expect(
        adapter.fetchTeamRoster({ externalTeamId: '999', team: 'Desconocido' }),
      ).rejects.toThrow(/jugador semilla/);
    });

    it('descubre el plantel completo (id, nombre, posición cruda normalizada) vía el jugador semilla', async () => {
      mockGetByUrl({
        playerstatistics: PLAYER_STATISTICS_HTML,
        '/regions/252/tournaments/2/': LEAGUE_TEAMS_HTML,
        '/matchstatistics/': PLAYER_MATCHSTATS_HTML,
        '/show/': PLAYER_MATCHSTATS_HTML,
      });
      await adapter.fetchLeagueTeams(League.PREMIER_LEAGUE); // cosecha la semilla del equipo 32

      const roster = await adapter.fetchTeamRoster({
        externalTeamId: '32',
        team: 'Manchester United',
      });

      expect(roster.length).toBe(20); // las 20 <option> del fixture real
      const brunoFernandes = roster.find((p) => p.externalId === '123761');
      expect(brunoFernandes).toBeDefined();
      expect(brunoFernandes!.name).toBe('Bruno Fernandes');
      expect(brunoFernandes!.rawPosition).toBe('MC'); // "M(CLR),FW" -> primer grupo, primera sub-posición
    });

    it('trae las métricas de la competencia sincronizada, promedio por partido (valores reales del fixture)', async () => {
      mockGetByUrl({
        playerstatistics: PLAYER_STATISTICS_HTML,
        '/regions/252/tournaments/2/': LEAGUE_TEAMS_HTML,
        '/matchstatistics/': PLAYER_MATCHSTATS_HTML,
        '/show/': PLAYER_MATCHSTATS_HTML,
      });
      await adapter.fetchLeagueTeams(League.PREMIER_LEAGUE);

      const roster = await adapter.fetchTeamRoster({
        externalTeamId: '32',
        team: 'Manchester United',
      });

      const brunoFernandes = roster.find((p) => p.externalId === '123761')!;
      expect(brunoFernandes.metricsFetchFailed).toBe(false);
      expect(brunoFernandes.metrics).toEqual({
        passesCompleted: 55.6,
        shots: 3.8,
        interceptions: 0,
        rating: 7.391999999999999,
      });
    });

    it('un jugador puntual con la página de estadísticas caída no aborta al resto del plantel (FR-018)', async () => {
      mockedAxios.get.mockImplementation((url: string) => {
        if (url.includes('playerstatistics')) {
          return Promise.resolve({ data: PLAYER_STATISTICS_HTML });
        }
        if (url.includes('/regions/252/tournaments/2/')) {
          return Promise.resolve({ data: LEAGUE_TEAMS_HTML });
        }
        if (url.includes('/players/123761/matchstatistics/')) {
          return Promise.reject(new Error('500'));
        }
        if (url.includes('/matchstatistics/') || url.includes('/show/')) {
          return Promise.resolve({ data: PLAYER_MATCHSTATS_HTML });
        }
        return Promise.reject(new Error(`URL no mockeada: ${url}`));
      });
      await adapter.fetchLeagueTeams(League.PREMIER_LEAGUE);

      const roster = await adapter.fetchTeamRoster({
        externalTeamId: '32',
        team: 'Manchester United',
      });

      expect(roster).toHaveLength(20);
      const brunoFernandes = roster.find((p) => p.externalId === '123761')!;
      expect(brunoFernandes.metricsFetchFailed).toBe(true);
      expect(brunoFernandes.metrics).toBeNull();
      const teammate = roster.find((p) => p.externalId !== '123761')!;
      expect(teammate.metricsFetchFailed).toBe(false);
    });
  });
});

describe('normalizeRawPosition', () => {
  it('deja tal cual un código sin paréntesis (GK, FW, DMC)', () => {
    expect(normalizeRawPosition('GK')).toBe('GK');
    expect(normalizeRawPosition('FW')).toBe('FW');
    expect(normalizeRawPosition('DMC')).toBe('DMC');
  });

  it('toma la primera sub-posición del primer grupo con paréntesis', () => {
    expect(normalizeRawPosition('D(CL),M(L)')).toBe('DC');
    expect(normalizeRawPosition('M(CLR),FW')).toBe('MC');
    expect(normalizeRawPosition('AM(C),FW')).toBe('AMC');
  });

  it('devuelve el texto tal cual cuando no matchea el patrón esperado (no inventa una categoría)', () => {
    expect(normalizeRawPosition('Forward')).toBe('Forward');
  });
});
