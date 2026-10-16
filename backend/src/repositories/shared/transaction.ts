import { EntityManager } from 'typeorm';

/**
 * Handle opaco de una transaccion de base ya abierta (020-order-matching-engine,
 * research.md D4 — primer precedente de transaccion/locking explicito de
 * TypeORM en este codebase). Vive en la capa de Repository: el Service solo
 * recibe y reenvia esta referencia, nunca el `EntityManager` lo usa
 * directamente (eso lo hace cada `TypeOrm*Repository` por dentro, que es el
 * unico lugar del sistema donde dominio y persistencia conviven,
 * constitucion Principio I).
 */
export interface Transaction {
  readonly manager: EntityManager;
}
