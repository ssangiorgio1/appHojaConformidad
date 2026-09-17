import type { Conformidad } from '../models/Conformidad.js';
import type { SubtareaIncidencia } from '../models/SubtareaIncidencia.js';
import type { HydratedDocument } from 'mongoose';

// Maqueta de los datos que eventualmente alimentarían una tabla Postgres de
// "unidades instaladas" en el backoffice nuevo (BO4) — ver
// ALCANCE_BACKOFFICE.md §14.6. Nada de acá escribe a ningún lado todavía: es
// la forma que tendría el payload el día que exista un endpoint/tabla real
// para recibirlo, para no tener que rediseñarla desde cero en ese momento.
//
// `unidadNombreOdoo` vs `patente` quedan las DOS a propósito — es la
// pregunta abierta de ALCANCE_BACKOFFICE.md §14.6: el `name` de la subtarea
// en Odoo a veces es una patente real (ej. `HIJJ30030`) y a veces un nombre
// largo/descriptivo que no sirve como identificador de unidad. Hasta que se
// defina ese criterio, se mandan ambos y BO4 decide cuál usar como clave.
export interface UnidadInstaladaPayload {
  origenConformidadId: string | null;
  origenIncidenciaId: string | null;
  ticketOdooId: number | null;
  tareaOdooId: number | null;
  subtareaOdooId: number | null;

  unidadNombreOdoo: string | null;
  patente: string | null;

  estado: 'instalada' | 'no_encontrada';
  tipoServicio: string | null;
  // El objeto `equipo` completo de la Conformidad, sin filtrar ni elegir
  // "instalado vs retirado" acá — es exactamente todo lo que ya se ve en el
  // resumen de la hoja (modelo/IMEI retirado e instalado, antenas, sensores,
  // módulos, entradas/salidas, control de instalación). Lo que el técnico no
  // cargó viaja vacío ('' o null, según el campo) tal cual está en Mongo. Qué
  // columnas separar de acá en la tabla real de BO4 es una decisión de
  // cuando se diseñe esa estructura, no de este mapper.
  equipo: Record<string, string | null> | null;

  clienteNombre: string | null;
  tecnicoId: string | null;
  fecha: string | null;
  hora: string | null;

  motivoNoEncontrada: string | null;

  creadoEn: string;
}

// Una unidad de un lote (o un servicio simple) que sí se instaló — nace de
// una Conformidad completa.
export function mapConformidadAUnidadInstalada(record: HydratedDocument<Conformidad>): UnidadInstaladaPayload {
  return {
    origenConformidadId: record._id.toString(),
    origenIncidenciaId: null,
    ticketOdooId: record.ticketOdoo?.odooId ?? null,
    tareaOdooId: record.tareaOdoo?.id ?? null,
    subtareaOdooId: record.subtareaOdoo?.id ?? null,

    unidadNombreOdoo: record.subtareaOdoo?.nombre || null,
    patente: record.matricula || null,

    estado: 'instalada',
    tipoServicio: record.tipoServicio ?? null,
    equipo: record.equipo ? (record.toObject().equipo as Record<string, string | null>) : null,

    clienteNombre: record.cliente || null,
    tecnicoId: record.tecnicoId ? record.tecnicoId.toString() : null,
    fecha: record.fecha || null,
    hora: record.hora || null,

    motivoNoEncontrada: null,

    creadoEn: new Date().toISOString(),
  };
}

// Una unidad de un lote que el técnico reportó como "no está en el lugar" —
// nace de una SubtareaIncidencia, nunca hubo Conformidad para ella. BO4
// necesita verla igual: es una unidad del lote que NO se instaló ese día —
// por eso `equipo: null`, a diferencia de una instalada real.
export function mapIncidenciaAUnidadInstalada(incidencia: HydratedDocument<SubtareaIncidencia>): UnidadInstaladaPayload {
  return {
    origenConformidadId: null,
    origenIncidenciaId: incidencia._id.toString(),
    ticketOdooId: null,
    tareaOdooId: incidencia.tareaOdooId,
    subtareaOdooId: incidencia.subtareaOdooId,

    unidadNombreOdoo: incidencia.subtareaNombre || null,
    patente: null,

    estado: 'no_encontrada',
    tipoServicio: null,
    equipo: null,

    clienteNombre: null,
    tecnicoId: incidencia.tecnicoId ? incidencia.tecnicoId.toString() : null,
    fecha: incidencia.fecha || null,
    hora: null,

    motivoNoEncontrada: incidencia.motivo || null,

    creadoEn: new Date().toISOString(),
  };
}
