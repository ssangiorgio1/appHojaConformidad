import { Schema, model, type InferSchemaType } from 'mongoose';

export const FLOTA_CATEGORIAS = [
  'baja_con_corte',
  'baja',
  'corte_reportando',
  'corte_sin_reportar',
  'sin_reportar_24h',
  'sin_reportar_48h',
  'sin_reportar_72h',
  'activo_reportando',
] as const;
export type FlotaCategoria = (typeof FLOTA_CATEGORIAS)[number];

export const FLOTA_TRAMOS = ['ok', 'mas_1_dia', 'mas_1_semana', 'nunca'] as const;
export type FlotaTramo = (typeof FLOTA_TRAMOS)[number];

// Foto de la flota de VisionBLO (movil/mapa cruzado con cliente/activo + cliente/baja), ver
// flota.service.ts. `actualizadoAt` marca en qué corrida se vio cada unidad: lo que no aparece
// en la corrida nueva se borra (una unidad que VisionBLO ya no lista).
const FlotaUnidadSchema = new Schema({
  movilId: { type: Number, required: true, unique: true },
  equipoId: { type: Number, default: null },
  nombre: { type: String, required: true },
  matricula: { type: String, default: null },
  interno: { type: String, default: null },
  clienteId: { type: Number, required: true, index: true },
  clienteNombre: { type: String, default: null },
  movilBaja: { type: Boolean, required: true },
  clienteBaja: { type: Boolean, default: null },
  corteDeServicio: { type: Boolean, default: null },
  latitud: { type: Number, default: null },
  longitud: { type: Number, default: null },
  ultimoReporte: { type: Date, default: null },
  tramoReporte: { type: String, enum: FLOTA_TRAMOS, required: true },
  categoria: { type: String, enum: FLOTA_CATEGORIAS, required: true, index: true },
  // Última vez que ESTA unidad cambió (el refresco sólo escribe lo que cambió, ver flota.service.ts).
  actualizadoAt: { type: Date, required: true },
});

export type FlotaUnidad = InferSchemaType<typeof FlotaUnidadSchema>;
export const FlotaUnidadModel = model('FlotaUnidad', FlotaUnidadSchema);

// Cuándo se hizo el último refresco completo (aunque no haya cambiado ninguna unidad).
const FlotaMetaSchema = new Schema({
  _id: { type: String, required: true },
  actualizadoAt: { type: Date, required: true },
});
export const FlotaMetaModel = model('FlotaMeta', FlotaMetaSchema);
