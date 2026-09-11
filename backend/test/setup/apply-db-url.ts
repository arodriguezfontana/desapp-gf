import { readFileSync } from 'node:fs';
import { PG_URI_FILE } from './testcontainers';

/**
 * setupFiles: corre una vez por archivo de test, antes del framework. Toma la
 * connection string del Postgres efímero (la dejó global-setup) y la pone en el
 * entorno para que `DatabaseModule` / `AppModule` se conecten ahí y nunca contra
 * la base persistente de desarrollo.
 */
const { uri } = JSON.parse(readFileSync(PG_URI_FILE, 'utf8')) as { uri: string };
process.env.DATABASE_URL = uri;
process.env.NODE_ENV = 'test';
