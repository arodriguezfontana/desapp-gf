import { Team, TeamProps } from './team';

const BASE_PROPS: TeamProps = {
  whoScoredName: 'Real Madrid',
  footballDataTeamId: 86,
  footballDataTeamName: 'Real Madrid CF',
  leagueCode: 'PD',
  crestUrl: 'https://crests.football-data.org/86.png',
};

describe('Team', () => {
  describe('restore', () => {
    it('restaura un equipo con id', () => {
      const team = Team.restore('team-uuid-1', BASE_PROPS);

      expect(team.id).toBe('team-uuid-1');
      expect(team.whoScoredName).toBe('Real Madrid');
      expect(team.footballDataTeamId).toBe(86);
    });

    it('restaura correctamente con crestUrl null', () => {
      const team = Team.restore('team-uuid-2', { ...BASE_PROPS, crestUrl: null });

      expect(team.id).toBe('team-uuid-2');
      expect(team.crestUrl).toBeNull();
    });

    it('expone todos los getters correctamente', () => {
      const team = Team.restore('team-uuid-3', BASE_PROPS);

      expect(team.leagueCode).toBe('PD');
      expect(team.footballDataTeamName).toBe('Real Madrid CF');
    });
  });
});
