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

  const MANCHESTER_UNITED = { externalTeamId: '32', team: 'Manchester United' };
  const PREMIER_LEAGUE_TOURNAMENT_ID = 2;
  const BRUNO_FERNANDES_ID = '123761';

  describe('fetchLeagueTeams', () => {
    it('parsea los equipos reales de la liga desde el fixture capturado, sin duplicados, junto con tournamentId y el mapa de jugadores semilla', async () => {
      mockGetByUrl({
        playerstatistics: PLAYER_STATISTICS_HTML,
        '/regions/252/tournaments/2/': LEAGUE_TEAMS_HTML,
      });

      const result = await adapter.fetchLeagueTeams(League.PREMIER_LEAGUE);

      expect(result.tournamentId).toBe(PREMIER_LEAGUE_TOURNAMENT_ID);
      expect(result.teams.length).toBeGreaterThan(0);
      const ids = result.teams.map((t) => t.externalTeamId);
      expect(new Set(ids).size).toBe(ids.length); // sin duplicados
      expect(result.teams).toContainEqual(MANCHESTER_UNITED);
      // playerAssistData del fixture: {"TeamId":32,"GSPlayerId":123761,"GAPlayerId":300713}
      // — GAPlayerId pisa a GSPlayerId para el mismo TeamId (mismo orden de .set() que antes).
      expect(result.seedPlayerByTeam.get('32')).toBe('300713');
    });

    it('propaga el error si no se puede obtener la página de la liga (FR-014 nivel liga)', async () => {
      mockedAxios.get.mockRejectedValue(new Error('timeout'));

      await expect(
        adapter.fetchLeagueTeams(League.PREMIER_LEAGUE),
      ).rejects.toThrow('timeout');
    });

    it.each([
      ['0', '"GAPlayerId":0'],
      ['null', '"GAPlayerId":null'],
      ['undefined (clave ausente)', ''],
    ])(
      'un GAPlayerId inválido (%s) en una entrada posterior no pisa la semilla válida ya guardada para el mismo equipo',
      async (_label, secondEntryGAPlayerIdJson) => {
        // La segunda entrada representa otro gol del mismo equipo, sin
        // asistencia real: su GSPlayerId también se pone inválido (0) para
        // que esta entrada no aporte ningún write válido y así aislar
        // específicamente si el GAPlayerId inválido pisa lo que ya había
        // quedado de la primera entrada (GSPlayerId=123761, luego
        // GAPlayerId=300713 — la semilla final esperada). JSON no tiene un
        // literal `undefined`: ese caso se simula omitiendo la clave por
        // completo, que es como luce en JS un campo ausente.
        const secondEntry = secondEntryGAPlayerIdJson
          ? `{"TeamId":32,"GSPlayerId":0,${secondEntryGAPlayerIdJson}}`
          : `{"TeamId":32,"GSPlayerId":0}`;
        const html = `
          <html><body>
            <a href="/regions/252/tournaments/2/seasons/11141/stages/25544/playerstatistics/x">stats</a>
            <script>
              require.config.params['args'] = {
                playerAssistData: [
                  {"TeamId":32,"GSPlayerId":123761,"GAPlayerId":300713},
                  ${secondEntry}
                ],
              };
            </script>
          </body></html>
        `;
        mockGetByUrl({
          playerstatistics: html,
          '/regions/252/tournaments/2/': LEAGUE_TEAMS_HTML,
        });

        const result = await adapter.fetchLeagueTeams(League.PREMIER_LEAGUE);

        // La segunda entrada no aporta ningún id válido (ni GS ni GA): la
        // semilla debe seguir siendo la de la primera entrada, no perderse
        // ni quedar en "0"/"null"/"undefined".
        expect(result.seedPlayerByTeam.get('32')).toBe('300713');
      },
    );

    it('un GSPlayerId inválido no se guarda como semilla (mismo guard que GAPlayerId, sin asumir que GSPlayerId siempre es válido)', async () => {
      const html = `
        <html><body>
          <a href="/regions/252/tournaments/2/seasons/11141/stages/25544/playerstatistics/x">stats</a>
          <script>
            require.config.params['args'] = {
              playerAssistData: [{"TeamId":99,"GSPlayerId":0,"GAPlayerId":null}],
            };
          </script>
        </body></html>
      `;
      mockGetByUrl({
        playerstatistics: html,
        '/regions/252/tournaments/2/': LEAGUE_TEAMS_HTML,
      });

      const result = await adapter.fetchLeagueTeams(League.PREMIER_LEAGUE);

      expect(result.seedPlayerByTeam.has('99')).toBe(false);
    });
  });

  describe('fetchTeamRoster', () => {
    it('descubre el plantel completo (id, nombre, posición cruda normalizada) vía el jugador semilla recibido por parámetro', async () => {
      mockGetByUrl({
        '/matchstatistics/': PLAYER_MATCHSTATS_HTML,
        '/show/': PLAYER_MATCHSTATS_HTML,
      });

      const roster = await adapter.fetchTeamRoster(
        MANCHESTER_UNITED,
        PREMIER_LEAGUE_TOURNAMENT_ID,
        BRUNO_FERNANDES_ID,
      );

      expect(roster.length).toBe(20); // las 20 <option> del fixture real
      const brunoFernandes = roster.find((p) => p.externalId === BRUNO_FERNANDES_ID);
      expect(brunoFernandes).toBeDefined();
      expect(brunoFernandes!.name).toBe('Bruno Fernandes');
      expect(brunoFernandes!.rawPosition).toBe('MC'); // "M(CLR),FW" -> primer grupo, primera sub-posición
    });

    it('trae las métricas de la competencia (tournamentId) recibida por parámetro, promedio por partido (valores reales del fixture)', async () => {
      mockGetByUrl({
        '/matchstatistics/': PLAYER_MATCHSTATS_HTML,
        '/show/': PLAYER_MATCHSTATS_HTML,
      });

      const roster = await adapter.fetchTeamRoster(
        MANCHESTER_UNITED,
        PREMIER_LEAGUE_TOURNAMENT_ID,
        BRUNO_FERNANDES_ID,
      );

      const brunoFernandes = roster.find((p) => p.externalId === BRUNO_FERNANDES_ID)!;
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
        if (url.includes(`/players/${BRUNO_FERNANDES_ID}/matchstatistics/`)) {
          return Promise.reject(new Error('500'));
        }
        if (url.includes('/matchstatistics/') || url.includes('/show/')) {
          return Promise.resolve({ data: PLAYER_MATCHSTATS_HTML });
        }
        return Promise.reject(new Error(`URL no mockeada: ${url}`));
      });

      const roster = await adapter.fetchTeamRoster(
        MANCHESTER_UNITED,
        PREMIER_LEAGUE_TOURNAMENT_ID,
        BRUNO_FERNANDES_ID,
      );

      expect(roster).toHaveLength(20);
      const brunoFernandes = roster.find((p) => p.externalId === BRUNO_FERNANDES_ID)!;
      expect(brunoFernandes.metricsFetchFailed).toBe(true);
      expect(brunoFernandes.metrics).toBeNull();
      const teammate = roster.find((p) => p.externalId !== BRUNO_FERNANDES_ID)!;
      expect(teammate.metricsFetchFailed).toBe(false);
    });

    it('lanza si la página del jugador semilla no tiene ningún <option> en el breadcrumb (selector no matchea nada, p. ej. WhoScored cambió la estructura de la página)', async () => {
      const PLAYER_PAGE_WITHOUT_SQUAD_HTML = `
        <html><body>
          <div id="breadcrumb-nav">
            <span class="separator">&raquo;</span>
          </div>
        </body></html>
      `;
      mockGetByUrl({ '/show/': PLAYER_PAGE_WITHOUT_SQUAD_HTML });

      await expect(
        adapter.fetchTeamRoster(
          MANCHESTER_UNITED,
          PREMIER_LEAGUE_TOURNAMENT_ID,
          BRUNO_FERNANDES_ID,
        ),
      ).rejects.toThrow(/plantel.*vino vacío/i);
    });

    it('dos corridas "simultáneas" con tournamentId distintos no se pisan entre sí: el Adapter no tiene estado compartido', async () => {
      // Mismo jugador semilla, mismo fixture: su página trae varias
      // competencias embebidas (Premier League id=2, Champions League
      // id=12, entre otras — valores reales, ver player-matchstatistics.html).
      // Dos llamadas a fetchTeamRoster con distinto tournamentId, disparadas
      // con Promise.all (interleaved a nivel de microtask, no secuenciales),
      // deben resolver cada una con las métricas de SU PROPIO tournamentId.
      // Antes del fix, ambas hubiesen leído el mismo `this.currentTournamentId`
      // (lo que haya escrito la última en pisar el campo).
      mockGetByUrl({
        '/matchstatistics/': PLAYER_MATCHSTATS_HTML,
        '/show/': PLAYER_MATCHSTATS_HTML,
      });

      const [premierLeagueRun, championsLeagueRun] = await Promise.all([
        adapter.fetchTeamRoster(MANCHESTER_UNITED, 2, BRUNO_FERNANDES_ID),
        adapter.fetchTeamRoster(MANCHESTER_UNITED, 12, BRUNO_FERNANDES_ID),
      ]);

      const brunoPremierLeague = premierLeagueRun.find(
        (p) => p.externalId === BRUNO_FERNANDES_ID,
      )!;
      const brunoChampionsLeague = championsLeagueRun.find(
        (p) => p.externalId === BRUNO_FERNANDES_ID,
      )!;

      expect(brunoPremierLeague.metrics).toEqual({
        passesCompleted: 55.6,
        shots: 3.8,
        interceptions: 0,
        rating: 7.391999999999999,
      });
      expect(brunoChampionsLeague.metrics).toEqual({
        passesCompleted: 46,
        shots: 3,
        interceptions: 1,
        rating: 8.47,
      });
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
