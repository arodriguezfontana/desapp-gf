import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as pg from 'pg';

/**
 * Configura la conexion a PostgreSQL leyendo `DATABASE_URL` del entorno en runtime.
 * El valor de la cadena de conexion vive unicamente en `backend/.env` (no versionado).
 *
 * `driver: pg` fuerza a que TypeORM use este módulo `pg` ya importado en vez de
 * resolverlo perezosamente con `require("pg")` en cada intento de conexión
 * (`PostgresDriver.loadDependencies`). Bajo Jest con `--runInBand`, cada archivo
 * de test e2e crea su propio registro de módulos y este `DataSource` se
 * reconstruye varias veces en el mismo proceso; a partir de la 3ª reconstrucción
 * esa resolución perezosa empieza a devolver `undefined` y el driver revienta con
 * `Cannot read properties of undefined (reading 'Pool')` en cada reintento
 * (bug reproducido localmente, ver PostgresDriver.js:1345 de typeorm@1.1.1).
 * Pasar el driver ya resuelto evita ese camino frágil por completo.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        driver: pg,
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
  ],
})
export class DatabaseModule {}
