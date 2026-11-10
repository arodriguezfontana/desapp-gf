import { withPlayerName } from './with-player-name';

class Sample {
  constructor(private readonly _id: string) {}

  get id(): string {
    return this._id;
  }

  shout(): string {
    return this._id.toUpperCase();
  }
}

describe('withPlayerName', () => {
  it('adjunta el nombre del jugador', () => {
    expect(withPlayerName(new Sample('a'), 'Messi').playerName).toBe('Messi');
  });

  it('conserva los getters y metodos de la entidad', () => {
    const enriched = withPlayerName(new Sample('abc'), 'Messi');
    expect(enriched.id).toBe('abc');
    expect(enriched.shout()).toBe('ABC');
  });

  it('no muta la entidad original', () => {
    const original = new Sample('a');
    withPlayerName(original, 'Messi');
    expect('playerName' in original).toBe(false);
  });

  it('cada llamada devuelve un objeto independiente', () => {
    const original = new Sample('a');
    const first = withPlayerName(original, 'Messi');
    const second = withPlayerName(original, 'Cristiano');
    expect(first.playerName).toBe('Messi');
    expect(second.playerName).toBe('Cristiano');
  });
});
