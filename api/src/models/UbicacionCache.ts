import { Schema, model, type InferSchemaType } from 'mongoose';

// Resultado ya resuelto de una "Ubicación de la unidad" (ver ubicacion.service.ts): las coordenadas de un link no
// cambian, así que se guarda para no volver a expandir el link ni consultar la dirección en cada apertura de la ficha.
// Vence solo a los 180 días por si se corrige el mapa de la zona.
const UbicacionCacheSchema = new Schema(
  {
    texto: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    nombre: { type: String, default: null },
    direccion: { type: String, default: null },
    calle: { type: String, default: null },
    ciudad: { type: String, default: null },
    provincia: { type: String, default: null },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 180 },
  },
  { versionKey: false },
);

export type UbicacionCache = InferSchemaType<typeof UbicacionCacheSchema>;
export const UbicacionCacheModel = model('UbicacionCache', UbicacionCacheSchema);
