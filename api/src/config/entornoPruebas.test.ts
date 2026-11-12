import { describe, expect, it } from 'vitest';
import { esOdooDeDesarrollo, hostDeMongo, motivosDeBloqueo } from './entornoPruebas.js';

const LOCAL = 'mongodb://localhost:27018/wara-pruebas';
const STAGING = 'https://wara-v1-testing-40479066.dev.odoo.com';
const PRODUCCION = 'https://wara-v1.odoo.com';

describe('hostDeMongo', () => {
  it('acepta localhost y 127.0.0.1, con o sin puerto y credenciales', () => {
    expect(hostDeMongo(LOCAL)).toBe('localhost');
    expect(hostDeMongo('mongodb://127.0.0.1/x')).toBe('127.0.0.1');
    expect(hostDeMongo('mongodb://u:p@localhost:27017/x?authSource=admin')).toBe('localhost');
  });
  it('rechaza Atlas y cualquier host remoto', () => {
    expect(hostDeMongo('mongodb+srv://u:p@cluster0.abc.mongodb.net/wara')).toBeNull();
    expect(hostDeMongo('mongodb://u:p@mongo.ejemplo.com:27017/x')).toBeNull();
  });
  it('no se deja engañar por "localhost" en el usuario o en la ruta', () => {
    expect(hostDeMongo('mongodb://localhost:p@mongo.ejemplo.com/x')).toBeNull();
    expect(hostDeMongo('mongodb://mongo.ejemplo.com/localhost')).toBeNull();
  });
  it('en una réplica exige que todos los hosts sean locales', () => {
    expect(hostDeMongo('mongodb://localhost:1,mongo.ejemplo.com:2/x')).toBeNull();
    expect(hostDeMongo('mongodb://localhost:1,127.0.0.1:2/x')).toBe('localhost');
  });
  it('un valor que no es una URI de Mongo no cuenta como local', () => {
    expect(hostDeMongo('')).toBeNull();
    expect(hostDeMongo('localhost')).toBeNull();
  });
});

describe('esOdooDeDesarrollo', () => {
  it('solo *.dev.odoo.com', () => {
    expect(esOdooDeDesarrollo(STAGING)).toBe(true);
    expect(esOdooDeDesarrollo(PRODUCCION)).toBe(false);
    expect(esOdooDeDesarrollo('https://dev.odoo.com.evil.example')).toBe(false);
    expect(esOdooDeDesarrollo('no es una url')).toBe(false);
  });
});

describe('motivosDeBloqueo', () => {
  const ATLAS = 'mongodb+srv://u:p@cluster0.x.mongodb.net/wara';
  it('fuera de Render y sin pruebas bloquea una Mongo remota', () => {
    expect(motivosDeBloqueo({ MONGODB_URI: ATLAS, ODOO_URL: PRODUCCION })).toHaveLength(1);
    expect(motivosDeBloqueo({ MONGODB_URI: LOCAL, ODOO_URL: PRODUCCION })).toEqual([]);
  });
  it('en Render no frena nada', () => {
    expect(motivosDeBloqueo({ MONGODB_URI: ATLAS, ODOO_URL: PRODUCCION, EN_RENDER: true })).toEqual([]);
  });
  it('los tests y PERMITIR_BASE_REAL=1 saltan el freno general', () => {
    expect(motivosDeBloqueo({ MONGODB_URI: ATLAS, ODOO_URL: PRODUCCION, NODE_ENV: 'test' })).toEqual([]);
    expect(motivosDeBloqueo({ MONGODB_URI: ATLAS, ODOO_URL: PRODUCCION, PERMITIR_BASE_REAL: '1' })).toEqual([]);
  });
  it('en pruebas con Mongo local y Odoo de desarrollo deja arrancar', () => {
    expect(motivosDeBloqueo({ WARA_ENTORNO: 'pruebas', MONGODB_URI: LOCAL, ODOO_URL: STAGING })).toEqual([]);
  });
  it('en pruebas bloquea Mongo remoto y Odoo de producción, aunque haya PERMITIR_BASE_REAL', () => {
    expect(motivosDeBloqueo({ WARA_ENTORNO: 'pruebas', MONGODB_URI: ATLAS, ODOO_URL: STAGING })).toHaveLength(1);
    expect(motivosDeBloqueo({ WARA_ENTORNO: 'pruebas', MONGODB_URI: LOCAL, ODOO_URL: PRODUCCION })).toHaveLength(1);
    expect(motivosDeBloqueo({ WARA_ENTORNO: 'pruebas', MONGODB_URI: ATLAS, ODOO_URL: PRODUCCION, PERMITIR_BASE_REAL: '1' })).toHaveLength(2);
  });
});
