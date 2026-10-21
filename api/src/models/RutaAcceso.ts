import { Schema, model, type InferSchemaType } from 'mongoose';

// Rutas de acceso rápido (Costanera, Corredor del Oeste, Acceso Este, Acceso Sur…): coordinación marca sus puntos
// clave en el mapa y el trazo se calcula por las calles. Una unidad "pertenece" a la ruta que le queda a menos de `anchoKm` del trazo (ver el panel,
// web/src/lib/rutasAcceso.ts) y dentro de la ruta se visita según su avance desde la oficina.
const RutaAccesoSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true, unique: true },
    color: { type: String, required: true, default: '#2563eb' },
    // Distancia máxima, en km, a la que una unidad se considera "sobre" la ruta.
    anchoKm: { type: Number, required: true, default: 3, min: 0.2, max: 50 },
    // Puntos marcados en el mapa, [longitud, latitud], en el sentido de salida desde la oficina (ej. el inicio y el
    // final del acceso, y algún punto del medio). Son lo único que se edita.
    puntos: { type: [[Number]], required: true },
    // Trazo por las calles que pasa por esos puntos: lo calcula el servicio de rutas al guardar (ver ruteo.service.ts).
    trazo: { type: [[Number]], required: true },
    activa: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type RutaAcceso = InferSchemaType<typeof RutaAccesoSchema>;
export const RutaAccesoModel = model('RutaAcceso', RutaAccesoSchema);
