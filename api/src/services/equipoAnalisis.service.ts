import type { EstadoEquipo } from './equipoEstado.service.js';
import type { GraficasEquipo } from './equipoGraficas.service.js';

// Análisis por reglas (sin IA) del estado + gráficas de UN equipo: parametriza los casos que siempre
// se repiten (no reporta, batería descargada, alimentación mala, GPS sin fix...) y devuelve hallazgos
// con causa probable. Función pura: no consulta nada, así es testeable y portable (ver bo4).

export type Severidad = 'critico' | 'alerta' | 'info';

export interface Hallazgo {
  codigo: string;
  severidad: Severidad;
  mensaje: string;
  causaProbable: string;
  evidencia: Record<string, unknown>;
}

// Todos los umbrales juntos para poder ajustarlos con datos reales sin tocar las reglas.
export const UMBRALES = {
  // El equipo reporta cada ~10 min.
  sinReporteAlertaMin: 60,
  sinReporteCriticoMin: 24 * 60,
  huecoSerieMin: 45,
  // Alimentación del vehículo (se asume 12 V; >18 V de mediana se trata como sistema de 24 V).
  cargadorBajo12: 11.0,
  cargadorAlto12: 15.5,
  cargadorBajo24: 22.0,
  cargadorAlto24: 31.0,
  cargadorDesconectado: 3.0,
  cargadorRuidoDesvio: 1.2,
  // Batería interna Li-ion.
  bateriaBaja: 3.6,
  bateriaCritica: 3.4,
  bateriaCaidaV: 0.15,
  // Señal del modem (dBm).
  senalDebil: -95,
  senalMuyDebil: -105,
  // GPS.
  satelitesMin: 4,
  hdopMalo: 5,
  fraccionMalaCalidadGps: 0.4,
  // Ignición contra voltaje (12 V).
  igOnVoltajeMax: 12.6,
  igOffVoltajeMin: 13.4,
  muestrasMinimas: 6,
} as const;

const U = UMBRALES;

const num = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
const validos = (serie: [number, number | null][]) => serie.filter((p): p is [number, number] => num(p[1]));
const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const desvio = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};
const fmt = (ms: number) => new Date(ms).toISOString();
const minutos = (ms: number) => Math.round(ms / 60_000);

// Valor de la serie vigente en el instante t (último punto con tiempo <= t).
function valorEn(serie: [number, number][], t: number): number | null {
  let out: number | null = null;
  for (const [ts, v] of serie) {
    if (ts > t) break;
    out = v;
  }
  return out;
}

export function analizarEquipo(estado: EstadoEquipo, graficas: GraficasEquipo, ahora = Date.now()): Hallazgo[] {
  const out: Hallazgo[] = [];
  const { series } = graficas;
  const cargador = validos(series.cargador);
  const bateria = validos(series.bateriaInterna);
  const senal = validos(series.senalDbm);
  const sats = validos(series.satelites);
  const hdop = validos(series.hdop);
  const ignicion = validos(series.ignicion);

  const bajaOCorte = estado.movil && (estado.movil.baja || estado.movil.bajaCliente || estado.movil.corteDeServicio);

  // --- 1. Reporte ---------------------------------------------------------------------------
  const ult = estado.ultimoReporte ? Date.parse(estado.ultimoReporte) : NaN;
  if (Number.isNaN(ult)) {
    out.push({
      codigo: 'NUNCA_REPORTO',
      severidad: 'critico',
      mensaje: 'El equipo no tiene ningún reporte registrado.',
      causaProbable: 'Equipo nunca encendido/instalado, o SIM sin datos / sin activar.',
      evidencia: { iccid: estado.iccid, sim: estado.senalesVistas.sim },
    });
  } else {
    const edadMin = minutos(ahora - ult);
    if (edadMin >= U.sinReporteAlertaMin) {
      // Contexto previo al silencio: ¿qué pasó con alimentación, batería y señal justo antes?
      const cargAntes = valorEn(cargador, ult);
      const batAntes = valorEn(bateria, ult);
      const senalAntes = valorEn(senal, ult);
      const causas: string[] = [];
      if (bajaOCorte) causas.push('El móvil/cliente figura de baja o con corte de servicio: silencio esperable.');
      else {
        if (num(cargAntes) && cargAntes < U.cargadorDesconectado)
          causas.push('Se quedó sin alimentación del vehículo (cargador ~0 V antes del silencio): equipo desconectado o batería del vehículo cortada.');
        if (num(batAntes) && batAntes < U.bateriaBaja)
          causas.push(`Batería interna baja (${batAntes.toFixed(2)} V) al dejar de reportar: probablemente se descargó sin alimentación externa.`);
        if (num(senalAntes) && senalAntes < U.senalMuyDebil)
          causas.push(`Señal muy débil (${senalAntes} dBm) al último reporte: zona sin cobertura o antena dañada.`);
        if (!causas.length)
          causas.push(
            `Sin señal clara previa al corte: revisar SIM (saldo/estado de la línea), antena o equipo retirado/dañado.${estado.senalesVistas.sim ? '' : ' (bo3 nunca vio un evento de SIM en este equipo.)'}`,
          );
      }
      out.push({
        codigo: 'SIN_REPORTE',
        severidad: bajaOCorte ? 'info' : edadMin >= U.sinReporteCriticoMin ? 'critico' : 'alerta',
        mensaje: `Último reporte hace ${edadMin >= 1440 ? `${Math.round(edadMin / 1440)} días` : `${edadMin} min`}.`,
        causaProbable: causas.join(' '),
        evidencia: { ultimoReporte: estado.ultimoReporte, cargadorAntes: cargAntes, bateriaAntes: batAntes, senalAntes, movil: estado.movil },
      });
    }
  }

  // Huecos dentro del rango consultado (equipo que reporta pero intermitente).
  const marcas = series.cargador.map((p) => p[0]).sort((a, b) => a - b);
  const huecos: { desde: string; hasta: string; min: number }[] = [];
  for (let i = 1; i < marcas.length; i++) {
    const d = minutos(marcas[i] - marcas[i - 1]);
    if (d >= U.huecoSerieMin) huecos.push({ desde: fmt(marcas[i - 1]), hasta: fmt(marcas[i]), min: d });
  }
  if (huecos.length >= 2 || (huecos.length === 1 && huecos[0].min >= 180)) {
    out.push({
      codigo: 'REPORTE_INTERMITENTE',
      severidad: 'alerta',
      mensaje: `${huecos.length} hueco(s) de más de ${U.huecoSerieMin} min en el estado general del rango.`,
      causaProbable: 'Cobertura intermitente, alimentación que se corta y vuelve (falso contacto) o reinicios del equipo.',
      evidencia: { huecos: huecos.slice(0, 10) },
    });
  }

  // --- 2. Alimentación (cargador) -----------------------------------------------------------
  if (cargador.length >= U.muestrasMinimas) {
    const vs = cargador.map((p) => p[1]);
    const med = mediana(vs);
    const es24 = med > 18;
    const bajo = es24 ? U.cargadorBajo24 : U.cargadorBajo12;
    const alto = es24 ? U.cargadorAlto24 : U.cargadorAlto12;
    const enCero = vs.filter((v) => v < U.cargadorDesconectado).length / vs.length;
    const fueraRango = vs.filter((v) => v >= U.cargadorDesconectado && (v < bajo || v > alto)).length / vs.length;
    const sd = desvio(vs.filter((v) => v >= U.cargadorDesconectado));

    if (enCero > 0.9) {
      out.push({
        codigo: 'SIN_ALIMENTACION',
        severidad: 'critico',
        mensaje: 'El equipo reporta sin alimentación externa casi todo el rango (está funcionando a batería interna).',
        causaProbable: 'Cable de alimentación suelto/cortado, fusible quemado, o instalado en una línea sin tensión.',
        evidencia: { medianaV: med, porcentajeEnCero: Math.round(enCero * 100) },
      });
    } else if (enCero > 0.1) {
      out.push({
        codigo: 'ALIMENTACION_INTERMITENTE',
        severidad: 'alerta',
        mensaje: `La alimentación cae a ~0 V en el ${Math.round(enCero * 100)}% de las muestras.`,
        causaProbable: 'Falso contacto en el cableado, empalme flojo o fusible/llave general que corta.',
        evidencia: { porcentajeEnCero: Math.round(enCero * 100), medianaV: med },
      });
    }
    if (fueraRango > 0.2) {
      const bajaTension = mediana(vs.filter((v) => v >= U.cargadorDesconectado)) < bajo;
      out.push({
        codigo: bajaTension ? 'TENSION_BAJA' : 'TENSION_ALTA',
        severidad: 'alerta',
        mensaje: `Tensión de alimentación fuera de ${bajo}–${alto} V en el ${Math.round(fueraRango * 100)}% de las muestras (mediana ${med.toFixed(1)} V).`,
        causaProbable: bajaTension
          ? 'Batería del vehículo descargada/sulfatada, caída de tensión por cable fino o conexión con resistencia.'
          : 'Regulador/alternador defectuoso o picos de tensión: riesgo para el equipo.',
        evidencia: { medianaV: med, porcentajeFueraRango: Math.round(fueraRango * 100), sistema: es24 ? '24V' : '12V' },
      });
    }
    if (sd > U.cargadorRuidoDesvio && enCero <= 0.1) {
      out.push({
        codigo: 'ALIMENTACION_RUIDOSA',
        severidad: 'info',
        mensaje: `Tensión de alimentación inestable (desvío ${sd.toFixed(2)} V).`,
        causaProbable: 'Mala masa, conexión floja o carga pesada compartida en la misma línea. Si el vehículo estuvo arrancando en el rango puede ser normal.',
        evidencia: { desvioV: Number(sd.toFixed(2)), medianaV: med },
      });
    }
  }

  // --- 3. Batería interna -------------------------------------------------------------------
  if (bateria.length >= U.muestrasMinimas) {
    const vs = bateria.map((p) => p[1]);
    const ultimaBat = vs[vs.length - 1];
    const sinAlim = estado.voltajeCargador !== null && estado.voltajeCargador < U.cargadorDesconectado;
    if (ultimaBat < U.bateriaCritica) {
      out.push({
        codigo: 'BATERIA_CRITICA',
        severidad: 'critico',
        mensaje: `Batería interna en ${ultimaBat.toFixed(2)} V (crítica).`,
        causaProbable: sinAlim
          ? 'Descargada por falta de alimentación externa; se apagará pronto.'
          : 'Batería interna degradada o que no carga (aun con alimentación): reemplazar.',
        evidencia: { ultimaV: ultimaBat, cargadorActual: estado.voltajeCargador },
      });
    } else if (ultimaBat < U.bateriaBaja) {
      out.push({
        codigo: 'BATERIA_BAJA',
        severidad: 'alerta',
        mensaje: `Batería interna en ${ultimaBat.toFixed(2)} V.`,
        causaProbable: sinAlim ? 'Funcionando sin alimentación externa y descargándose.' : 'Batería interna que no está cargando bien.',
        evidencia: { ultimaV: ultimaBat, cargadorActual: estado.voltajeCargador },
      });
    }
    // Tendencia: con alimentación presente la batería debería mantenerse/subir.
    const caida = vs[0] - ultimaBat;
    const alimentado = cargador.length > 0 && mediana(cargador.map((p) => p[1])) >= U.cargadorBajo12;
    if (alimentado && caida > U.bateriaCaidaV) {
      out.push({
        codigo: 'BATERIA_NO_CARGA',
        severidad: 'alerta',
        mensaje: `La batería interna bajó ${caida.toFixed(2)} V en el rango aun con alimentación externa normal.`,
        causaProbable: 'Circuito de carga defectuoso o batería interna en fin de vida.',
        evidencia: { inicioV: vs[0], finV: ultimaBat },
      });
    }
  }

  // --- 4. Señal del modem -------------------------------------------------------------------
  if (senal.length >= U.muestrasMinimas) {
    const med = mediana(senal.map((p) => p[1]));
    if (med < U.senalDebil) {
      out.push({
        codigo: 'SENAL_DEBIL',
        severidad: med < U.senalMuyDebil ? 'alerta' : 'info',
        mensaje: `Señal celular débil (mediana ${med} dBm).`,
        causaProbable: 'Antena del modem mal ubicada/desconectada, equipo tapado por metal, o zona de poca cobertura del operador.',
        evidencia: { medianaDbm: med, operador: estado.simOperador },
      });
    }
  }

  // --- 5. GPS -------------------------------------------------------------------------------
  if (sats.length >= U.muestrasMinimas) {
    const malas = sats.filter((p) => p[1] < U.satelitesMin).length / sats.length;
    const hdopMalo = hdop.length ? hdop.filter((p) => p[1] > U.hdopMalo).length / hdop.length : 0;
    if (malas > U.fraccionMalaCalidadGps || hdopMalo > U.fraccionMalaCalidadGps) {
      out.push({
        codigo: 'GPS_SIN_FIX',
        severidad: 'alerta',
        mensaje: `Mala calidad de GPS: ${Math.round(malas * 100)}% de posiciones con <${U.satelitesMin} satélites, ${Math.round(hdopMalo * 100)}% con HDOP > ${U.hdopMalo}.`,
        causaProbable: 'Antena GPS tapada/orientada hacia abajo, detrás de vidrio metalizado o cableado de antena dañado. Si el vehículo está en garage cubierto puede ser transitorio.',
        evidencia: { medianaSatelites: mediana(sats.map((p) => p[1])), medianaHdop: hdop.length ? mediana(hdop.map((p) => p[1])) : null },
      });
    }
  }
  // Velocidad > 0 con ignición apagada, o ignición encendida sin movimiento nunca: incoherencias.
  const vel = validos(series.velocidad);
  if (ignicion.length && vel.length) {
    const movConIgOff = vel.filter(([t, v]) => v > 5 && valorEn(ignicion, t) === 0).length;
    if (movConIgOff >= 3) {
      out.push({
        codigo: 'IGNICION_INCOHERENTE',
        severidad: 'alerta',
        mensaje: `${movConIgOff} posiciones con velocidad >5 km/h y ignición apagada.`,
        causaProbable: 'Cable de ignición mal conectado (a un accesorio en lugar de ignición real) o sin conectar.',
        evidencia: { muestras: movConIgOff },
      });
    }
  }

  // --- 6. Ignición vs tensión ---------------------------------------------------------------
  if (ignicion.length && cargador.length >= U.muestrasMinimas) {
    const med = mediana(cargador.map((p) => p[1]));
    if (med < 18) {
      const conIgOn = cargador.filter(([t, v]) => valorEn(ignicion, t) === 1 && v >= U.cargadorDesconectado);
      const conIgOff = cargador.filter(([t, v]) => valorEn(ignicion, t) === 0 && v >= U.cargadorDesconectado);
      const medOn = conIgOn.length >= 3 ? mediana(conIgOn.map((p) => p[1])) : NaN;
      const medOff = conIgOff.length >= 3 ? mediana(conIgOff.map((p) => p[1])) : NaN;
      if (num(medOn) && medOn < U.igOnVoltajeMax) {
        out.push({
          codigo: 'IGN_ON_SIN_CARGA_ALTERNADOR',
          severidad: 'info',
          mensaje: `Con ignición encendida la tensión es ${medOn.toFixed(1)} V (el alternador debería dar ≥${U.igOnVoltajeMax} V).`,
          causaProbable: 'Alternador que no carga, batería del vehículo en mal estado, o ignición del equipo tomada de un cable que no corresponde.',
          evidencia: { medianaIgOn: medOn, medianaIgOff: num(medOff) ? medOff : null },
        });
      }
      if (num(medOff) && medOff > U.igOffVoltajeMin) {
        out.push({
          codigo: 'IGN_OFF_CON_ALTA_TENSION',
          severidad: 'info',
          mensaje: `Con ignición apagada la tensión sigue en ${medOff.toFixed(1)} V (típico de motor en marcha).`,
          causaProbable: 'El cable de ignición del equipo no se enciende con la llave: está tomado de un positivo permanente.',
          evidencia: { medianaIgOff: medOff },
        });
      }
    }
  }

  // --- 7. Coherencia diagnóstico vs gráficas ------------------------------------------------
  if (estado.voltajeCargador !== null && cargador.length) {
    const ultimaGraf = cargador[cargador.length - 1][1];
    if (Math.abs(estado.voltajeCargador - ultimaGraf) > 3 && Math.abs(Date.parse(estado.ultimoReporte ?? '') - cargador[cargador.length - 1][0]) < 30 * 60_000) {
      out.push({
        codigo: 'DATOS_NO_COINCIDEN',
        severidad: 'info',
        mensaje: `El voltaje del diagnóstico (${estado.voltajeCargador} V) no coincide con el último de la gráfica (${ultimaGraf} V).`,
        causaProbable: 'Variación real entre muestras (arranque/apagado) o dato desactualizado en el diagnóstico de bo3.',
        evidencia: { diagnostico: estado.voltajeCargador, grafica: ultimaGraf },
      });
    }
  }

  // --- 8. Firmware / módulos ----------------------------------------------------------------
  if (estado.firmware.actualizacionDisponible) {
    out.push({
      codigo: 'FIRMWARE_DESACTUALIZADO',
      severidad: 'info',
      mensaje: `Hay firmware nuevo disponible (actual ${estado.firmware.version ?? 'desconocido'}).`,
      causaProbable: 'Equipo sin actualizar.',
      evidencia: { detalle: estado.firmware.detalleActualizacion },
    });
  }
  for (const m of estado.modulos.detectados) {
    if (m.advertencia) {
      out.push({
        codigo: 'MODULO_ADVERTENCIA',
        severidad: 'alerta',
        mensaje: `${m.descripcion} (${m.serie}): ${m.advertencia}`,
        causaProbable: 'Módulo con versión/limitación conocida.',
        evidencia: { serie: m.serie },
      });
    }
  }
  const esperados: [string, boolean][] = [
    ['RFID', estado.senalesVistas.rfid],
    ['Pantalla', estado.senalesVistas.pantalla],
  ];
  for (const [nombre, visto] of esperados) {
    const hay = estado.modulos.detectados.some((m) => (nombre === 'RFID' ? /RFID/i : /Pantalla/i).test(m.descripcion));
    if (visto && !hay && estado.modulos.fecha) {
      out.push({
        codigo: 'MODULO_AUSENTE',
        severidad: 'alerta',
        mensaje: `Se recibieron eventos de ${nombre} alguna vez pero hoy no hay ningún módulo ${nombre} detectado.`,
        causaProbable: 'Módulo desconectado, cable de datos dañado o módulo retirado.',
        evidencia: { modulosDetectados: estado.modulos.detectados.map((m) => m.serie), ultimaLecturaModulos: estado.modulos.fecha },
      });
    }
  }

  const orden: Record<Severidad, number> = { critico: 0, alerta: 1, info: 2 };
  return out.sort((a, b) => orden[a.severidad] - orden[b.severidad]);
}
