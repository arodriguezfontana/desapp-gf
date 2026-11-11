import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPackageManifest, resolveBuildInfo } from './build-info';

describe('resolveBuildInfo', () => {
  it('toma nombre y versión del package.json, commit de GIT_COMMIT y entorno de NODE_ENV', () => {
    const info = resolveBuildInfo(
      { GIT_COMMIT: 'abc1234', NODE_ENV: 'production' },
      { name: 'backend', version: '1.2.3' },
      'v22.0.0',
    );

    expect(info).toEqual({
      name: 'backend',
      version: '1.2.3',
      commit: 'abc1234',
      environment: 'production',
      node: 'v22.0.0',
    });
  });

  it('sin GIT_COMMIT el commit es null y sin NODE_ENV el entorno es development', () => {
    const info = resolveBuildInfo({}, { name: 'backend', version: '1.0.0' });

    expect(info.commit).toBeNull();
    expect(info.environment).toBe('development');
  });

  it('trata como ausentes los valores de entorno vacíos o con sólo espacios', () => {
    const info = resolveBuildInfo({ GIT_COMMIT: '  ', NODE_ENV: '' }, { name: 'backend', version: '1.0.0' });

    expect(info.commit).toBeNull();
    expect(info.environment).toBe('development');
  });

  it('sin manifiesto, o con campos que no son texto, nombre y versión quedan en unknown', () => {
    expect(resolveBuildInfo({}, null)).toMatchObject({ name: 'unknown', version: 'unknown' });
    expect(resolveBuildInfo({}, { name: 42, version: '' })).toMatchObject({ name: 'unknown', version: 'unknown' });
  });

  it('no publica ninguna otra variable de entorno', () => {
    const info = resolveBuildInfo(
      { DATABASE_URL: 'postgres://user:secreto@host/db', JWT_SECRET: 'secreto', NODE_ENV: 'test' },
      { name: 'backend', version: '1.0.0' },
    );

    expect(JSON.stringify(info)).not.toContain('secreto');
    expect(Object.keys(info).sort()).toEqual(['commit', 'environment', 'name', 'node', 'version']);
  });

  it('por defecto informa la versión de Node del proceso', () => {
    expect(resolveBuildInfo({}, null).node).toBe(process.version);
  });
});

describe('readPackageManifest', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'build-info-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('lee el package.json del directorio indicado', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '9.9.9' }));

    expect(readPackageManifest(dir)).toEqual({ name: 'x', version: '9.9.9' });
  });

  it('devuelve null si no hay package.json', () => {
    expect(readPackageManifest(dir)).toBeNull();
  });

  it('devuelve null si el package.json no es JSON válido', () => {
    writeFileSync(join(dir, 'package.json'), '{ esto no es json');

    expect(readPackageManifest(dir)).toBeNull();
  });
});
