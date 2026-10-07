const PREFIXES_SUFFIXES =
  /\b(fc|afc|cf|sc|sl|as|ss|fk)\b\.?/gi;

export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(PREFIXES_SUFFIXES, '')
    .replace(/\s+/g, ' ')
    .trim();
}
