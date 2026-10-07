import { normalizeTeamName } from './normalize-team-name';

describe('normalizeTeamName', () => {
  it('convierte a minúsculas', () => {
    expect(normalizeTeamName('Manchester City')).toBe('manchester city');
  });

  it('elimina prefijo FC', () => {
    expect(normalizeTeamName('FC Bayern München')).toBe('bayern munchen');
  });

  it('elimina sufijo FC', () => {
    expect(normalizeTeamName('Manchester City FC')).toBe('manchester city');
  });

  it('elimina prefijo AFC', () => {
    expect(normalizeTeamName('AFC Bournemouth')).toBe('bournemouth');
  });

  it('elimina prefijo SS', () => {
    expect(normalizeTeamName('SS Lazio')).toBe('lazio');
  });

  it('elimina prefijo AS', () => {
    expect(normalizeTeamName('AS Monaco')).toBe('monaco');
  });

  it('elimina prefijo SC', () => {
    expect(normalizeTeamName('SC Freiburg')).toBe('freiburg');
  });

  it('elimina acentos', () => {
    expect(normalizeTeamName('Atlético Madrid')).toBe('atletico madrid');
  });

  it('elimina diéresis', () => {
    expect(normalizeTeamName('Bayern München')).toBe('bayern munchen');
  });

  it('colapsa espacios extra tras eliminar prefijo', () => {
    expect(normalizeTeamName('FC  Barcelona')).toBe('barcelona');
  });

  it('devuelve string vacío para input vacío', () => {
    expect(normalizeTeamName('')).toBe('');
  });

  it('no altera nombres sin prefijos ni acentos', () => {
    expect(normalizeTeamName('Chelsea')).toBe('chelsea');
  });

  it('elimina prefijo FC con punto (FC.)', () => {
    expect(normalizeTeamName('FC. Barcelona')).toBe('barcelona');
  });
});
