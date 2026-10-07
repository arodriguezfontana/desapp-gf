import { Standing } from './standing';
import { TeamNameException } from './team-name-exception';
import { normalizeTeamName } from './normalize-team-name';

export function resolveTeam(
  whoScoredTeamName: string,
  standings: Standing[],
  exceptions: TeamNameException[],
): Standing | null {
  if (!whoScoredTeamName) return null;

  const needle = normalizeTeamName(whoScoredTeamName);

  const byNormalization = standings.find(
    (s) => normalizeTeamName(s.teamName) === needle,
  );
  if (byNormalization) return byNormalization;

  const exception = exceptions.find(
    (e) => e.whoScoredRawName === whoScoredTeamName,
  );
  if (!exception) return null;

  return (
    standings.find((s) => s.externalTeamId === exception.footballDataTeamId) ??
    null
  );
}
