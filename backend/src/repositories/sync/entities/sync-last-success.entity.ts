import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Entidad de persistencia de la última sincronización exitosa por fuente (spec 031, data-model.md). Una
 * fila por fuente; sin claves foráneas ni datos personales. Sólo la usa `SyncLastSuccessRepository`.
 */
@Entity('sync_last_success')
export class SyncLastSuccessEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  source!: string;

  @Column({ name: 'succeeded_at', type: 'timestamptz' })
  succeededAt!: Date;
}
