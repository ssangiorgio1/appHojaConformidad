import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configurada: vi.fn(),
  ultimoReporte: vi.fn(),
  postJson: vi.fn(),
}));

vi.mock('../config/visionbloApi.js', () => ({
  visionbloApiConfigurada: mocks.configurada,
  ultimoReporteApi: mocks.ultimoReporte,
}));
vi.mock('../config/visionblo.js', async () => {
  class VisionbloError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { VisionbloError, visionbloPostJson: mocks.postJson };
});
vi.mock('../models/FlotaUnidad.js', () => ({
  FlotaUnidadModel: { findOne: () => ({ lean: async () => ({ matricula: 'AB121VV' }) }), find: () => ({ lean: async () => [] }) },
}));

import { VisionbloError } from '../config/visionblo.js';
import { estadoDesdeApi, getEstadoEquipo } from './equipoEstado.service.js';

const AHORA = new Date('2026-11-10T14:30:00.000Z');

// Recorte de la respuesta real de ultimo_reporte del equipo 33452 (10/11/2026).
const API = {
  ok: true as const,
  ultima_recepcion: '2026-11-10T14:23:22.000Z',
  ultimo_reporte: {
    posicion: { fecha: '2026-11-10T14:23:21.000Z', datos: { latitud: -328476235, longitud: -687989665, altitud: 621, velocidad: 73, orientacion: 211, satelites: 27, hdop: 2, odometro: 150404529 } },
    estado_general: { fecha: '2026-11-10T14:21:28.000Z', datos: { voltaje_bateria: 4.146, voltaje_cargador: 28.076, dbm_modem: -63, temperatura_modem: 0 } },
    ignicion: { fecha: '2026-11-10T11:21:15.000Z', datos: { presente: true } },
    modulos: { fecha: '2026-11-10T14:22:18.000Z', datos: { modulos: ['2F1D0018', '2F1D0019'] } },
    sim: { fecha: '2026-08-15T10:19:48.000Z', datos: { slot: 0, imsi: '722076900884748', iccid: '8954079900008847482' } },
    corte_de_motor: { fecha: '2026-08-15T10:19:20.000Z', datos: { corte: false } },
    rfid: { fecha: '2022-03-12T10:45:10.000Z', datos: [] },
    panico: { fecha: '2022-11-29T13:58:00.000Z', datos: {} },
    firmware_actualizado: { fecha: '2022-06-01T22:57:44.000Z', datos: {} },
    temperatura1: { fecha: '2026-11-10T14:21:19.000Z', datos: { serie: '4b7a750087415a28', temperatura: 12.8 } },
    debug: { fecha: '2026-11-10T14:00:00.000Z', datos: {} },
  },
};

const DG = {
  equipo: {
    id: 33452,
    nombre: 't20s916',
    serie: '2006916',
    imei: '860000000000001',
    iccid: '8954079900008847482',
    fecha_ultimo_reporte: '2026-11-10T14:23:22.000Z',
    fecha_posicion: '2026-11-10T14:23:21.000Z',
    latitud: -328476235,
    longitud: -687989665,
    fecha_ignicion: '2026-11-10T11:21:15.000Z',
    ignicion: true,
    fecha_voltaje_cargador: '2026-11-10T14:21:28.000Z',
    voltaje_cargador: 28.091,
    fecha_firmware: '2022-06-01T22:57:44.000Z',
    firmware: '{"version":"2021-03-15T14:11:02","miniavl":true}',
  },
  pantalla: false,
  corte_motor: false,
  sim: { telefono: '2615550000', info: { operator: { name: 'Personal' } } },
  peticion_radioescucha: false,
  peticion_posicion: false,
  panico: { fecha: '2022-11-29T13:58:00.000Z' },
  rfid: true,
  fuel: false,
  movil: { cliente: 'Cliente SA', movil: 'AB 121 VV', cliente_id: 286, baja: false, baja_cliente: false, corte_de_servicio: false },
};

describe('estadoDesdeApi', () => {
  it('toma el reporte de la API y suma identificadores, SIM, firmware y móvil del diagnóstico', () => {
    const e = estadoDesdeApi(33452, API, DG as never, 'AB121VV', null, AHORA);
    expect(e.origen).toEqual({ fuente: 'api+cookie', aviso: null });
    expect(e.ultimoReporte).toBe('2026-11-10T14:23:22.000Z');
    expect(e.posicion).toEqual({ latitud: -32.8476235, longitud: -68.7989665, fecha: '2026-11-10T14:23:21.000Z' });
    expect(e.ignicion).toEqual({ encendida: true, fecha: '2026-11-10T11:21:15.000Z' });
    expect(e.voltajeCargador).toBe(28.076); // de la API, no del diagnóstico (28.091)
    expect(e.bateriaInterna).toBe(4.146);
    expect(e.senalDbm).toBe(-63);
    expect(e.gps).toEqual({ satelites: 27, hdop: 2, fecha: '2026-11-10T14:23:21.000Z' });
    expect(e.modulos.detectados.map((m) => m.descripcion)).toEqual(['RFID', 'RFID (buzzer interno)']);
    // del diagnóstico
    expect(e.serie).toBe('2006916');
    expect(e.nombre).toBe('t20s916');
    expect(e.imei).toBe('860000000000001');
    expect(e.simOperador).toBe('Personal');
    expect(e.firmware.version).toBe('v21.03.15r851 (MiniAVL)');
    expect(e.movil).toEqual({ cliente: 'Cliente SA', movil: 'AB 121 VV', matricula: 'AB121VV', baja: false, bajaCliente: false, corteDeServicio: false });
    expect(e.senalesVistas).toEqual({ pantalla: false, rfid: true, fuel: false, sim: true, corteMotor: false, panico: '2022-11-29T13:58:00.000Z' });
  });

  it('sin diagnóstico queda parcial: campos de bo3 en null, aviso, y el resto sale de la API', () => {
    const e = estadoDesdeApi(33452, API, null, null, 'Datos parciales: la sesión de VisionBLO venció.', AHORA);
    expect(e.origen.fuente).toBe('api');
    expect(e.origen.aviso).toContain('Datos parciales');
    expect(e.serie).toBeNull();
    expect(e.imei).toBeNull();
    expect(e.simOperador).toBeNull();
    expect(e.movil).toBeNull();
    expect(e.firmware.version).toBeNull();
    expect(e.firmware.fecha).toBe('2022-06-01T22:57:44.000Z');
    expect(e.iccid).toBe('8954079900008847482');
    expect(e.posicion).not.toBeNull();
    expect(e.ignicion?.encendida).toBe(true);
    expect(e.modulos.detectados).toHaveLength(2);
    expect(e.senalesVistas.rfid).toBe(true);
    expect(e.senalesVistas.sim).toBe(true);
    expect(e.senalesVistas.corteMotor).toBe(false);
    expect(e.senalesVistas.panico).toBe('2022-11-29T13:58:00.000Z');
  });

  it('eventosRecientes: solo las últimas 6 h, sin posicion ni debug, del más nuevo al más viejo', () => {
    const e = estadoDesdeApi(33452, API, null, null, null, AHORA);
    expect(e.eventosRecientes.map((x) => x.evento)).toEqual(['modulos', 'estado_general', 'temperatura1', 'ignicion']);
    expect(e.eventosRecientes[0].datos).toEqual({ modulos: ['2F1D0018', '2F1D0019'] });
  });

  it('un evento con datos [] (array vacío) se normaliza a {}', () => {
    const e = estadoDesdeApi(1, { ...API, ultimo_reporte: { rfid: { fecha: '2026-11-10T14:00:00.000Z', datos: [] } } }, null, null, null, AHORA);
    expect(e.eventosRecientes).toEqual([{ fecha: '2026-11-10T14:00:00.000Z', evento: 'rfid', datos: {} }]);
  });

  it('equipo que nunca reportó: todo vacío, sin romper', () => {
    const e = estadoDesdeApi(1, { ok: true, ultima_recepcion: false, ultimo_reporte: {} }, null, null, null, AHORA);
    expect(e.ultimoReporte).toBeNull();
    expect(e.posicion).toBeNull();
    expect(e.ignicion).toBeNull();
    expect(e.gps).toBeNull();
    expect(e.modulos).toEqual({ fecha: null, detectados: [] });
    expect(e.eventosRecientes).toEqual([]);
  });

  it('un voltaje que llega como string se convierte a número', () => {
    const e = estadoDesdeApi(1, { ...API, ultimo_reporte: { estado_general: { fecha: '2026-11-10T14:00:00.000Z', datos: { voltaje_cargador: '12,5', voltaje_bateria: null, dbm_modem: -70 } } } }, null, null, null, AHORA);
    expect(e.voltajeCargador).toBe(12.5);
    expect(e.bateriaInterna).toBeNull();
  });
});

describe('getEstadoEquipo: la API manda, la cookie es respaldo', () => {
  let id = 100;
  const historial: unknown[] = [];
  beforeEach(() => {
    id += 1;
    vi.clearAllMocks();
    mocks.configurada.mockReturnValue(true);
    // Responde como bo3 según el path.
    mocks.postJson.mockImplementation(async (path: string) => {
      if (path === 'equipo/diagnostico') return DG;
      if (path === 'equipo/modulos') return { modulos: [], fecha: null };
      if (path === 'equipo/historial') return historial;
      throw new Error(`path inesperado ${path}`);
    });
  });

  it('API + cookie ok: 1 pedido a la API y 1 solo a bo3 (el diagnóstico)', async () => {
    mocks.ultimoReporte.mockResolvedValue(API);
    const e = await getEstadoEquipo(id, { forzar: true });
    expect(e.origen.fuente).toBe('api+cookie');
    expect(mocks.postJson.mock.calls.map((c) => c[0])).toEqual(['equipo/diagnostico']);
  });

  it('API ok y cookie caída: devuelve el estado parcial con aviso, no error', async () => {
    mocks.ultimoReporte.mockResolvedValue(API);
    mocks.postJson.mockRejectedValue(new VisionbloError('SESSION_EXPIRED', 'venció'));
    const e = await getEstadoEquipo(id, { forzar: true });
    expect(e.origen.fuente).toBe('api');
    expect(e.origen.aviso).toContain('la sesión de VisionBLO venció');
    expect(e.posicion).not.toBeNull();
    expect(e.movil).toBeNull();
  });

  it('API caída y cookie ok: cae al camino completo por cookie, sin repetir el diagnóstico', async () => {
    mocks.ultimoReporte.mockRejectedValue(new Error('API caída'));
    const e = await getEstadoEquipo(id, { forzar: true });
    expect(e.origen.fuente).toBe('cookie');
    expect(mocks.postJson.mock.calls.filter((c) => c[0] === 'equipo/diagnostico')).toHaveLength(1);
    expect(mocks.postJson.mock.calls.map((c) => c[0]).sort()).toEqual(['equipo/diagnostico', 'equipo/historial', 'equipo/modulos']);
  });

  it('camino por cookie con el historial caído (connect timeout): estado parcial con aviso, no error', async () => {
    mocks.configurada.mockReturnValue(false);
    mocks.postJson.mockImplementation(async (path: string) => {
      if (path === 'equipo/diagnostico') return DG;
      if (path === 'equipo/modulos') return { modulos: [], fecha: null };
      throw new VisionbloError('NETWORK', 'No se pudo conectar con VisionBLO (equipo/historial) (UND_ERR_CONNECT_TIMEOUT).');
    });
    const e = await getEstadoEquipo(id, { forzar: true });
    expect(e.origen.fuente).toBe('cookie');
    expect(e.origen.aviso).toContain('historial');
    expect(e.eventosRecientes).toEqual([]);
    expect(e.gps).toBeNull();
  });

  it('camino por cookie con sesión vencida en el historial: sigue siendo error', async () => {
    mocks.configurada.mockReturnValue(false);
    mocks.postJson.mockImplementation(async (path: string) => {
      if (path === 'equipo/historial') throw new VisionbloError('SESSION_EXPIRED', 'venció');
      if (path === 'equipo/modulos') return { modulos: [], fecha: null };
      return DG;
    });
    await expect(getEstadoEquipo(id, { forzar: true })).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  });

  it('las dos caídas: error de la cookie con el motivo de la API anexado', async () => {
    mocks.ultimoReporte.mockRejectedValue(new Error('API caída'));
    mocks.postJson.mockRejectedValue(new VisionbloError('SESSION_EXPIRED', 'venció'));
    await expect(getEstadoEquipo(id, { forzar: true })).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
      message: expect.stringContaining('API caída'),
    });
  });

  it('sin token de API: camino por cookie de siempre, sin llamar a la API', async () => {
    mocks.configurada.mockReturnValue(false);
    const e = await getEstadoEquipo(id, { forzar: true });
    expect(e.origen.fuente).toBe('cookie');
    expect(mocks.ultimoReporte).not.toHaveBeenCalled();
  });
});
