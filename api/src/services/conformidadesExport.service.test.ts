import { describe, expect, it } from 'vitest';
import {
  ENCABEZADOS_EXPORT,
  ENCABEZADOS_INSTALADO,
  armarHojasExport,
  elementosInstalados,
  equiposDe,
  fechaAr,
  filaDeConformidad,
  idsDeUsuariosDe,
  numeroDe,
  resumenInstalado,
  tecnicoIdsDeQuery,
  textoAlta,
  type ConformidadParaExport,
} from './conformidadesExport.service.js';

const ID_A = 'a'.repeat(24);
const ID_B = 'b'.repeat(24);
const nombres: Record<string, string> = { [ID_A]: 'Renzo Gonzalez', [ID_B]: 'Ana Perez' };
const nombreDe = (id: unknown) => (id ? (nombres[String(id)] ?? '') : '');

const hoja: ConformidadParaExport = {
  codigoActa: 'CONF-20261116-ABCD1234',
  numero: '261116-XYZ12',
  cliente: 'Genco S.A.',
  responsableEmpresa: 'Álvaro Videla',
  tecnicoId: ID_A,
  matricula: 'AB123CD',
  tipoUnidad: 'vehiculo',
  ticketOdoo: { numero: '41271' },
  tareaOdoo: { id: 23335 },
  subtareaOdoo: { nombre: 'AB 123 CD' },
  tipoServicio: 'instalacion',
  instalaSensorModulo: false,
  fecha: '2026-11-16',
  hora: '10:30',
  status: 'completo',
  altaEquipo: {
    mesaAyuda: { checked: true, usuarioId: ID_B, fecha: new Date('2026-11-16T15:30:00Z') },
    coordinacion: { checked: false, usuarioId: null, fecha: null },
  },
  equipo: {
    modelo: '2006670',
    imei: '868817044905212',
    antenaGpsExt: 'Sí',
    sensorTemperatura: 'Sí',
    sensorTemperaturaCantidad: '2',
    modBPanico: 'Sí',
    camarasAdas: 'Sí',
    camarasAdasSerie: 'S1\nS2\nS3',
    mdvr: 'Sí',
    mdvrCanales: '8',
    mdvrSerie: 'MD-77',
    io1: 'Sí',
    io1Detalle: 'Puerta',
    controlSenalModem: '-89 dBm',
    controlCantidadSatGps: '11',
    controlBateriaInterna: '0,01 V',
    controlAlimentacionExterna: '15.4 V',
    controlOdometro: '45454',
    controlHorometro: '',
    controlRevisionIgnicion: 'SI',
    controlRevisionPanico: 'NO',
  },
  pre: { observaciones: 'Todo en orden' },
  post: { observaciones: 'Se dejó probado', fallaDetalle: '', firma: { satisfaccion: 'satisfecho', firmedAt: new Date('2026-11-16T16:00:00Z'), nombreFirmante: 'Álvaro Videla' } },
  verificacionEquipo: { avanzoBajoResponsabilidad: false },
  odooSync: { status: 'SYNCED' },
};

const col = (fila: (string | number)[], nombre: string) => {
  const i = ENCABEZADOS_EXPORT.indexOf(nombre);
  if (i < 0) throw new Error(`No hay columna "${nombre}"`);
  return fila[i];
};

describe('filaDeConformidad', () => {
  it('tiene una celda por encabezado, en el mismo orden, y los encabezados no se repiten', () => {
    expect(filaDeConformidad(hoja, nombreDe)).toHaveLength(ENCABEZADOS_EXPORT.length);
    expect(new Set(ENCABEZADOS_EXPORT).size).toBe(ENCABEZADOS_EXPORT.length);
  });

  it('datos de la visita con las mismas etiquetas que el panel', () => {
    const f = filaDeConformidad({ ...hoja, tipoServicio: 'reparacion', motivoIntervencion: 'cambio_equipo', instalaSensorModulo: true }, nombreDe);
    expect(col(f, 'Código de acta')).toBe('CONF-20261116-ABCD1234');
    expect(col(f, 'Cliente')).toBe('Genco S.A.');
    expect(col(f, 'Responsable de empresa')).toBe('Álvaro Videla');
    expect(col(f, 'Técnico')).toBe('Renzo Gonzalez');
    expect(col(f, 'Unidad')).toBe('AB123CD');
    expect(col(f, 'Tipo de unidad')).toBe('Vehículo');
    expect(col(f, 'Ticket Odoo')).toBe('41271');
    expect(col(f, 'Tarea Odoo')).toBe(23335);
    expect(col(f, 'Subtarea Odoo')).toBe('AB 123 CD');
    expect(col(f, 'Servicio')).toBe('Intervención · Cambio de equipo · Sensor / módulo');
    expect(col(f, 'Motivo de la intervención')).toBe('Cambio de equipo');
    expect(col(f, 'Fecha')).toBe('16/11/2026');
    expect(col(f, 'Hora')).toBe('10:30');
    expect(col(f, 'Estado')).toBe('Completo');
    expect(col(f, 'PDF en Odoo')).toBe('Enviada');
  });

  it('lo instalado: la cantidad de cada elemento en su columna, y vacío si no se instaló', () => {
    const f = filaDeConformidad(hoja, nombreDe);
    expect(col(f, 'Antena GPS (Ext)')).toBe(1);
    expect(col(f, 'Temperatura')).toBe(2);
    expect(col(f, 'Botón de pánico')).toBe(1);
    expect(col(f, 'Apertura de puertas')).toBe('');
    expect(col(f, 'Corte de motor')).toBe('');
  });

  it('cámaras ADAS: la cantidad es la de N° de serie, y las series quedan en su columna', () => {
    const f = filaDeConformidad(hoja, nombreDe);
    expect(col(f, 'Cámaras ADAS')).toBe(3);
    expect(col(f, 'N° de serie (Cámaras ADAS)')).toBe('S1, S2, S3');
  });

  it('detalles: canales del MDVR como número, serie, y el detalle de la entrada', () => {
    const f = filaDeConformidad(hoja, nombreDe);
    expect(col(f, 'MDVR (grabador de video)')).toBe(1);
    expect(col(f, 'Cámaras del MDVR (canales)')).toBe(8);
    expect(col(f, 'N° de serie (MDVR)')).toBe('MD-77');
    expect(col(f, 'Detalle entrada digital 1 (IO1)')).toBe('Puerta');
  });

  it('el detalle de un elemento no instalado queda vacío aunque haya texto viejo en la hoja', () => {
    const f = filaDeConformidad({ ...hoja, equipo: { ...hoja.equipo, io1: '', io1Detalle: 'quedó de antes' } }, nombreDe);
    expect(col(f, 'Entrada digital 1 (IO1)')).toBe('');
    expect(col(f, 'Detalle entrada digital 1 (IO1)')).toBe('');
  });

  it('control de instalación como números (para promediar) y los controles Sí/No', () => {
    const f = filaDeConformidad(hoja, nombreDe);
    expect(col(f, 'Señal del módem (dBm)')).toBe(-89);
    expect(col(f, 'Satélites GPS')).toBe(11);
    expect(col(f, 'Batería interna (V)')).toBe(0.01);
    expect(col(f, 'Alimentación externa (V)')).toBe(15.4);
    expect(col(f, 'Odómetro (km)')).toBe(45454);
    expect(col(f, 'Horómetro (hs)')).toBe('');
    expect(col(f, 'Control: ignición')).toBe('Sí');
    expect(col(f, 'Control: pánico')).toBe('No');
    expect(col(f, 'Control: conexión a la red')).toBe('');
  });

  it('observaciones, conformidad y firma del POST', () => {
    const f = filaDeConformidad(hoja, nombreDe);
    expect(col(f, 'Observaciones PRE')).toBe('Todo en orden');
    expect(col(f, 'Observaciones POST')).toBe('Se dejó probado');
    expect(col(f, 'Conformidad del cliente')).toBe('Firma conforme');
    expect(col(f, 'Firmó el POST')).toBe('Álvaro Videla');
    expect(col(f, 'Fecha de firma del POST')).toBe('16/11/2026, 13:00');
    const ausente = filaDeConformidad({ ...hoja, post: { firma: { clienteAusente: true } } }, nombreDe);
    expect(col(ausente, 'Conformidad del cliente')).toBe('Cliente ausente');
  });

  it('cada alta es UNA celda: hecha dice quién y cuándo (hora argentina); la pendiente, solo "Pendiente"', () => {
    const f = filaDeConformidad(hoja, nombreDe);
    expect(col(f, 'Alta mesa de ayuda')).toBe('Hecho · Ana Perez · 16/11/2026, 12:30');
    expect(col(f, 'Alta coordinación')).toBe('Pendiente');
    expect(ENCABEZADOS_EXPORT.filter((h) => h.startsWith('Alta'))).toEqual(['Alta mesa de ayuda', 'Alta coordinación']);
  });

  it('el técnico que cerró el POST solo figura si fue otro', () => {
    expect(col(filaDeConformidad({ ...hoja, tecnicoIdPost: ID_A }, nombreDe), 'Técnico que cerró el POST')).toBe('');
    expect(col(filaDeConformidad({ ...hoja, tecnicoIdPost: ID_B }, nombreDe), 'Técnico que cerró el POST')).toBe('Ana Perez');
  });

  it('cambio de unidad: origen, destino y destino con el equipo entregado por el cliente', () => {
    const base = { ...hoja, tipoServicio: 'cambio_unidad' as const };
    expect(col(filaDeConformidad({ ...base, cambioUnidad: { rol: 'origen' } }, nombreDe), 'Cambio de unidad')).toBe('Origen');
    expect(col(filaDeConformidad({ ...base, cambioUnidad: { rol: 'destino' } }, nombreDe), 'Cambio de unidad')).toBe('Destino');
    expect(col(filaDeConformidad({ ...base, cambioUnidad: { rol: 'destino', desdeRetiro: { unidad: 'SJJ 930' } } }, nombreDe), 'Cambio de unidad')).toBe(
      'Destino · equipo entregado por el cliente de SJJ 930',
    );
    expect(col(filaDeConformidad(hoja, nombreDe), 'Cambio de unidad')).toBe('');
  });

  it('una hoja vieja sin tipo de servicio figura como instalación, y "sin verificar" solo si avanzó bajo responsabilidad', () => {
    const vieja = filaDeConformidad({ ...hoja, tipoServicio: null, verificacionEquipo: { avanzoBajoResponsabilidad: true } }, nombreDe);
    expect(col(vieja, 'Servicio')).toBe('Instalación');
    expect(col(vieja, 'Equipo sin verificar')).toBe('Sí');
  });

  it('datos que faltan quedan como celda vacía, no como "undefined" ni "null"', () => {
    const fila = filaDeConformidad({ tecnicoId: 'x'.repeat(24) }, nombreDe);
    expect(fila.join('|')).not.toMatch(/undefined|null|NaN/);
  });
});

describe('equipo instalado y retirado según el servicio', () => {
  const equipo = { modelo: '111', imei: '1111', modeloInstalado: '222', imeiInstalado: '2222' };

  it('instalación o intervención sin cambio: lo que figura es el equipo de la unidad (instalado), nada retirado', () => {
    const e = equiposDe({ ...hoja, equipo });
    expect(e.instalado).toEqual({ numero: '111', imei: '1111' });
    expect(e.retirado.numero).toBe('');
  });
  it('cambio de equipo (también una intervención que terminó en cambio): modelo/imei es el retirado y modeloInstalado/imeiInstalado el que entra', () => {
    for (const d of [
      { ...hoja, equipo, tipoServicio: 'cambio_equipo' as const },
      { ...hoja, equipo, tipoServicio: 'reparacion' as const, motivoIntervencion: 'cambio_equipo' as const },
    ]) {
      const e = equiposDe(d);
      expect(e.instalado).toEqual({ numero: '222', imei: '2222' });
      expect(e.retirado).toMatchObject({ numero: '111', imei: '1111' });
    }
  });
  it('desinstalación y unidad vieja de un cambio de unidad: solo equipo retirado, y no se instaló nada', () => {
    for (const d of [
      { ...hoja, equipo, tipoServicio: 'desinstalacion' as const },
      { ...hoja, equipo, tipoServicio: 'cambio_unidad' as const, cambioUnidad: { rol: 'origen' as const } },
    ]) {
      const e = equiposDe(d);
      expect(e.instalado).toEqual({ numero: '', imei: '' });
      expect(e.retirado).toMatchObject({ numero: '111', imei: '1111' });
      expect(elementosInstalados({ ...d, equipo: { ...equipo, sensorTemperatura: 'Sí' } })).toEqual([]);
    }
  });
  it('se ven en sus columnas del Excel', () => {
    const f = filaDeConformidad({ ...hoja, equipo, tipoServicio: 'cambio_equipo' }, nombreDe);
    expect(col(f, 'N° de equipo instalado')).toBe('222');
    expect(col(f, 'IMEI instalado')).toBe('2222');
    expect(col(f, 'N° de equipo retirado')).toBe('111');
    expect(col(f, 'IMEI retirado')).toBe('1111');
  });
});

describe('elementos instalados y hoja "Instalado"', () => {
  it('una fila por elemento instalado, con su categoría, cantidad y detalle', () => {
    const elementos = elementosInstalados(hoja);
    expect(elementos.map((e) => e.elemento)).toEqual(
      expect.arrayContaining(['Antena GPS (Ext)', 'Temperatura', 'Botón de pánico', 'Cámaras ADAS', 'MDVR (grabador de video)', 'Entrada digital 1 (IO1)']),
    );
    expect(elementos.find((e) => e.elemento === 'Temperatura')).toMatchObject({ categoria: 'Sensores', cantidad: 2 });
    expect(elementos.find((e) => e.elemento === 'Antena GPS (Ext)')?.categoria).toBe('Equipo');
    expect(elementos.find((e) => e.elemento === 'Cámaras ADAS')).toMatchObject({ cantidad: 3, detalle: 'S1, S2, S3' });
    expect(elementos.find((e) => e.elemento === 'MDVR (grabador de video)')?.detalle).toBe('8 canales · MD-77');
  });

  it('el resumen se lee de corrido: "Temperatura ×2; Botón de pánico; Cámaras ADAS ×3 (S1, S2, S3)"', () => {
    const resumen = resumenInstalado(elementosInstalados(hoja));
    expect(resumen).toContain('Temperatura ×2');
    expect(resumen).toContain('Botón de pánico');
    expect(resumen).not.toContain('Botón de pánico ×');
    expect(resumen).toContain('Cámaras ADAS ×3 (S1, S2, S3)');
  });

  it('armarHojasExport trae las dos hojas, con filas del ancho de sus encabezados', () => {
    const [conformidades, instalado] = armarHojasExport([hoja, { ...hoja, codigoActa: 'CONF-2', equipo: { modelo: '5' } }], nombreDe);
    expect(conformidades.nombre).toBe('Conformidades');
    expect(conformidades.filas).toHaveLength(2);
    expect(conformidades.filas.every((f) => f.length === conformidades.encabezados.length)).toBe(true);
    expect(instalado.nombre).toBe('Instalado');
    expect(instalado.encabezados).toEqual(ENCABEZADOS_INSTALADO);
    expect(instalado.filas.every((f) => f.length === ENCABEZADOS_INSTALADO.length)).toBe(true);
    // La segunda hoja no instaló nada: solo la primera aporta filas.
    expect(new Set(instalado.filas.map((f) => f[0]))).toEqual(new Set(['CONF-20261116-ABCD1234']));
    expect(instalado.filas.find((f) => f[7] === 'Temperatura')).toEqual([
      'CONF-20261116-ABCD1234', '16/11/2026', 'Genco S.A.', 'AB123CD', 'Renzo Gonzalez', 'Instalación', 'Sensores', 'Temperatura', 2, '',
    ]);
  });
});

describe('numeroDe', () => {
  it('saca el número de lo que escribe el técnico ("-89 dBm", "15,4 V", "45454") y deja vacío lo vacío', () => {
    expect(numeroDe('-89 dBm')).toBe(-89);
    expect(numeroDe('15,4 V')).toBe(15.4);
    expect(numeroDe('45454')).toBe(45454);
    expect(numeroDe('0.01 V')).toBe(0.01);
    expect(numeroDe('')).toBe('');
    expect(numeroDe(undefined)).toBe('');
  });
  it('si no hay ningún número, queda el texto tal cual', () => {
    expect(numeroDe('sin señal')).toBe('sin señal');
  });
});

describe('textoAlta', () => {
  it('un alta hecha sin usuario o sin fecha (datos viejos) omite lo que falta, sin separadores sueltos', () => {
    expect(textoAlta({ checked: true, usuarioId: null, fecha: null }, nombreDe)).toBe('Hecho');
    expect(textoAlta({ checked: true, usuarioId: ID_B, fecha: null }, nombreDe)).toBe('Hecho · Ana Perez');
    expect(textoAlta(undefined, nombreDe)).toBe('Pendiente');
    expect(textoAlta({ checked: false, usuarioId: ID_B, fecha: new Date() }, nombreDe)).toBe('Pendiente');
  });
});

describe('idsDeUsuariosDe', () => {
  it('junta técnicos, técnicos del POST y quienes dieron el alta, sin repetir', () => {
    const otra = { ...hoja, tecnicoId: ID_B, tecnicoIdPost: ID_A };
    expect(idsDeUsuariosDe([hoja, otra]).sort()).toEqual([ID_A, ID_B].sort());
  });
});

describe('fechaAr', () => {
  it('pasa YYYY-MM-DD a DD/MM/YYYY y deja pasar otro formato', () => {
    expect(fechaAr('2026-01-05')).toBe('05/01/2026');
    expect(fechaAr('ayer')).toBe('ayer');
    expect(fechaAr(undefined)).toBe('');
  });
});

describe('tecnicoIdsDeQuery', () => {
  it('sin valor no hay filtro por técnico', () => {
    expect(tecnicoIdsDeQuery(undefined)).toBeNull();
    expect(tecnicoIdsDeQuery('')).toBeNull();
    expect(tecnicoIdsDeQuery('  ')).toBeNull();
  });
  it('un técnico o varios separados por coma', () => {
    expect(tecnicoIdsDeQuery(ID_A)).toEqual([ID_A]);
    expect(tecnicoIdsDeQuery(`${ID_A},${ID_B}`)).toEqual([ID_A, ID_B]);
    expect(tecnicoIdsDeQuery(` ${ID_A} , ${ID_B} ,`)).toEqual([ID_A, ID_B]);
  });
  it('descarta lo que no es un id (no coincide con nada en vez de romper la consulta)', () => {
    expect(tecnicoIdsDeQuery(`${ID_A},no-es-un-id`)).toEqual([ID_A]);
    expect(tecnicoIdsDeQuery('no-es-un-id')).toEqual([]);
  });
});
