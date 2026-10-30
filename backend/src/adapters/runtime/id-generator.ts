/**
 * Puerto para generar identificadores unicos de entidades nuevas. Mantiene a
 * los Services libres de la libreria de aleatoriedad (constitucion, Principio I:
 * las librerias de infraestructura viven detras de un Adapter) y permite ids
 * deterministas en los tests. Token: ID_GENERATOR.
 */
export interface IdGenerator {
  generate(): string;
}
