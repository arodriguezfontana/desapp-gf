import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Entidad de persistencia. Vive SOLO en la capa de repositorio; el Service nunca
 * la ve. El mapeo desde/hacia el dominio lo hace PlayerMapper.
 *
 * `league`/`position` son `varchar` simples, no un enum nativo de Postgres: el
 * dominio (League/Position) ya es la única fuente de verdad sobre qué valores son
 * válidos (research.md §6 de la feature 004-player-catalog).
 *
 * `id` sigue siendo un uuid no autogenerado por Postgres: para un jugador nuevo,
 * `PlayerSyncService` genera el id interno con `randomUUID()` antes del insert
 * (006-whoscored-catalog-sync, data-model.md). Desde `006`, la única vía de
 * escritura de esta tabla es la sincronización periódica vía
 * `PlayerRepository.applyTeamRosterSync` — nunca la API de lectura (FR-017).
 *
 * Las columnas nuevas de `006` (`externalId`, `removedAt`, métricas) no llevan
 * migration de esquema propia: igual que el resto de esta tabla, `synchronize`
 * (fuera de producción, `database.module.ts`, sin tocar) las agrega solo al
 * bootear con esta entidad ya actualizada. La única migration nueva de `006`
 * es de datos (`RemoveTestPlayerCatalogSeed`, borra las 20 filas ficticias de
 * `004` que no tienen `externalId`), mismo criterio que `SeedPlayerCatalog`.
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

  /**
   * Id del jugador en WhoScored — clave de upsert de la sincronización
   * (006-whoscored-catalog-sync, research.md §2). `nullable: true` a nivel de
   * columna a propósito (Postgres permite múltiples `NULL` bajo un `UNIQUE`,
   * así que esto no relaja la unicidad entre valores reales): forzar `NOT
   * NULL` en la entidad rompería el boot de `synchronize` mientras existan
   * filas sin este valor (las 20 de prueba de `004`, hasta que la migration
   * de datos las borra). Que todo jugador *real* lo tenga es un invariante
   * que garantiza `PlayerSyncInput` (dominio), no una constraint de Postgres
   * — mismo criterio que ya evita un enum nativo para `league`/`position`
   * (research.md §6 de `004-player-catalog`).
   */
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  externalId!: string | null;

  /**
   * Baja lógica (mismo patrón que `ApiKeyEntity.revokedAt`): `NULL` = vigente.
   * Un jugador que sale del plantel scrapeado de su equipo se marca acá en vez
   * de borrarse, para no romper una futura FK del Sistema de cotización
   * (research.md §2). La lectura (`findPage`/`findById`) filtra
   * `removed_at IS NULL`, así que a nivel de API el jugador desaparece y su id
   * anterior responde 404 (FR-016) aunque la fila siga existiendo.
   */
  @Column({ type: 'timestamptz', nullable: true })
  removedAt!: Date | null;

  /** Métrica de rendimiento, promedio por partido de la temporada en curso. */
  @Column({ type: 'double precision', nullable: true })
  passesCompleted!: number | null;

  @Column({ type: 'double precision', nullable: true })
  shots!: number | null;

  @Column({ type: 'double precision', nullable: true })
  interceptions!: number | null;

  @Column({ type: 'double precision', nullable: true })
  rating!: number | null;
}
