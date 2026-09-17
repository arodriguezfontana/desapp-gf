import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Entidad de persistencia. Vive SOLO en la capa de repositorio; el Service nunca
 * la ve. El mapeo desde/hacia el dominio lo hace PlayerMapper.
 *
 * `league`/`position` son `varchar` simples, no un enum nativo de Postgres: el
 * dominio (League/Position) ya es la única fuente de verdad sobre qué valores son
 * válidos (research.md §6 de la feature 004-player-catalog).
 *
 * Las filas de esta tabla las inserta únicamente la migration de seed de la
 * feature 004-player-catalog (catálogo de sólo lectura vía API, FR-015); por eso
 * usa `id` fijo (no autogenerado) en vez de `PrimaryGeneratedColumn`.
 */
@Entity('players')
export class PlayerEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 32 })
  league!: string;

  @Column({ type: 'varchar', length: 120 })
  team!: string;

  @Column({ type: 'varchar', length: 8 })
  position!: string;
}
