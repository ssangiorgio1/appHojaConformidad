import { Schema, model, type InferSchemaType } from 'mongoose';

// Zonas "bloqueadas" para un técnico: al repartir visitas, las unidades de estas rutas, departamentos o distritos
// van a ese técnico y los demás técnicos reciben el resto. Uno por técnico (se reemplaza completo al guardar).
const TerritorioTecnicoSchema = new Schema(
  {
    tecnicoId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, unique: true },
    // Nombre del técnico al guardar (para mostrar sin consultar usuarios).
    tecnicoNombre: { type: String, required: true },
    rutas: { type: [Schema.Types.ObjectId], ref: 'RutaAcceso', default: [] },
    departamentos: { type: [String], default: [] },
    // Clave `Departamento|Distrito`, igual que en el mapa de zonas del panel.
    distritos: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type TerritorioTecnico = InferSchemaType<typeof TerritorioTecnicoSchema>;
export const TerritorioTecnicoModel = model('TerritorioTecnico', TerritorioTecnicoSchema);
