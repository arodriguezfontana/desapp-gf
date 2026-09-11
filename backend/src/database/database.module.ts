import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Configura la conexion a PostgreSQL leyendo `DATABASE_URL` del entorno en runtime.
 * El valor de la cadena de conexion vive unicamente en `backend/.env` (no versionado).
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
  ],
})
export class DatabaseModule {}
