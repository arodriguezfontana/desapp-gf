import { PlayerMapper } from './player.mapper';
import { PlayerEntity } from '../entities/player.entity';
import { Player } from '../../../domain/player/player';

describe('PlayerMapper', () => {
  let mapper: PlayerMapper;

  beforeEach(() => {
    mapper = new PlayerMapper();
  });

  const baseEntity = (): PlayerEntity => {
    const e = new PlayerEntity();
    e.id = 'p1';
    e.name = 'Lionel Messi';
    e.league = 'Premier League';
    e.team = 'Inter Miami';
    e.position = 'FW';
    e.matchesPlayed = 20;
    e.passesCompleted = 400;
    e.shots = 60;
    e.interceptions = 5;
    e.rating = 8.5;
    e.goals = 15;
    e.assists = 10;
    e.keyPasses = 50;
    e.dribbles = 80;
    e.totalTackles = 8;
    e.yellowCards = 2;
    e.redCards = 0;
    return e;
  };

  describe('toDomain', () => {
    it('convierte una entidad completa al objeto de dominio Player', () => {
      const entity = baseEntity();
      const player = mapper.toDomain(entity);

      expect(player).toBeInstanceOf(Player);
      expect(player.id).toBe('p1');
      expect(player.name).toBe('Lionel Messi');
      expect(player.team).toBe('Inter Miami');
      expect(player.goals).toBe(15);
      expect(player.assists).toBe(10);
      expect(player.rating).toBe(8.5);
      expect(player.redCards).toBe(0);
    });

    it('preserva las métricas numéricas sin modificación', () => {
      const entity = baseEntity();
      entity.passesCompleted = 123;
      entity.shots = 45;
      entity.keyPasses = 67;
      entity.dribbles = 89;
      entity.totalTackles = 11;
      entity.yellowCards = 3;

      const player = mapper.toDomain(entity);

      expect(player.passesCompleted).toBe(123);
      expect(player.shots).toBe(45);
      expect(player.keyPasses).toBe(67);
      expect(player.dribbles).toBe(89);
      expect(player.totalTackles).toBe(11);
      expect(player.yellowCards).toBe(3);
    });

    it('maneja jugador con todas las métricas en null (datos incompletos del proveedor)', () => {
      const entity = baseEntity();
      entity.matchesPlayed = null as unknown as number;
      entity.passesCompleted = null as unknown as number;
      entity.shots = null as unknown as number;
      entity.interceptions = null as unknown as number;
      entity.goals = null as unknown as number;
      entity.assists = null as unknown as number;
      entity.keyPasses = null as unknown as number;
      entity.dribbles = null as unknown as number;
      entity.totalTackles = null as unknown as number;
      entity.yellowCards = null as unknown as number;
      entity.redCards = null as unknown as number;

      expect(() => mapper.toDomain(entity)).not.toThrow();
    });
  });

  describe('toEntity', () => {
    it('convierte un Player de dominio a su entidad de persistencia', () => {
      const entity = baseEntity();
      const player = mapper.toDomain(entity);

      const result = mapper.toEntity(player);

      expect(result).toBeInstanceOf(PlayerEntity);
      expect(result.id).toBe('p1');
      expect(result.name).toBe('Lionel Messi');
      expect(result.team).toBe('Inter Miami');
      expect(result.goals).toBe(15);
      expect(result.rating).toBe(8.5);
    });

    it('roundtrip: toDomain → toEntity preserva todos los campos', () => {
      const original = baseEntity();
      const player = mapper.toDomain(original);
      const restored = mapper.toEntity(player);

      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.league).toBe(original.league);
      expect(restored.team).toBe(original.team);
      expect(restored.position).toBe(original.position);
      expect(restored.matchesPlayed).toBe(original.matchesPlayed);
      expect(restored.passesCompleted).toBe(original.passesCompleted);
      expect(restored.shots).toBe(original.shots);
      expect(restored.interceptions).toBe(original.interceptions);
      expect(restored.rating).toBe(original.rating);
      expect(restored.goals).toBe(original.goals);
      expect(restored.assists).toBe(original.assists);
      expect(restored.keyPasses).toBe(original.keyPasses);
      expect(restored.dribbles).toBe(original.dribbles);
      expect(restored.totalTackles).toBe(original.totalTackles);
      expect(restored.yellowCards).toBe(original.yellowCards);
      expect(restored.redCards).toBe(original.redCards);
    });
  });
});
