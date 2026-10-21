'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { listUsuarios } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { imprimirPropuestas, propuestasHtml, type PropuestaCliente } from './propuestaVisitaHtml';
import type { UnidadConZona } from './SinReportarClientes';

const QUE_TENER_LISTO = [
  'La unidad disponible y con acceso al equipo instalado.',
  'Una persona autorizada para recibir al técnico y firmar la conformidad.',
  'Avisarnos si la unidad va a estar en otro lugar ese día.',
].join('\n');

interface Cliente {
  id: number;
  nombre: string;
  filas: UnidadConZona[];
}

// Datos de un documento. Hay unos generales y cada cliente puede cambiar los suyos.
interface Config {
  tecnico: string;
  fecha: string;
  desde: string;
  hasta: string;
  contacto: string;
  queTenerListo: string;
}

const GENERAL_INICIAL: Config = {
  tecnico: '',
  fecha: '',
  desde: '08:00',
  hasta: '12:00',
  contacto: 'coordinación de WARA',
  queTenerListo: QUE_TENER_LISTO,
};

const horarioInvalido = (c: Config) => Boolean(c.desde && c.hasta && c.hasta <= c.desde);

// Arma una propuesta de visita por cada cliente marcado en "Sin reportar" y la entrega como PDF
// (imprimir → "Guardar como PDF"). No envía nada: lo manda una persona. Cada documento tiene su propia
// configuración (técnico, día, horario, contacto y qué tener listo); lo que no se cambia usa lo general.
export function PropuestaVisita({
  clientes,
  series,
  tecnicoSugerido,
  onCerrar,
}: {
  clientes: Cliente[];
  /** Técnico que tiene asignado cada cliente por el recorrido calculado (por id de cliente). */
  tecnicoSugerido?: Record<number, string>;
  /** N° de equipo (serie) por `equipoId`, ya resuelto por la página. */
  series: Record<number, { serie: string | null } | null>;
  onCerrar: () => void;
}) {
  const { data: usuarios } = useApiData((idToken) => listUsuarios(idToken), []);
  const tecnicos = useMemo(() => (usuarios ?? []).filter((u) => u.role === 'tecnico' && u.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [usuarios]);

  const [general, setGeneral] = useState<Config>(GENERAL_INICIAL);
  // Cambios propios de cada cliente sobre lo general.
  const [propios, setPropios] = useState<Record<number, Partial<Config>>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  const configDe = (id: number): Config => ({ ...general, ...(tecnicoSugerido?.[id] ? { tecnico: tecnicoSugerido[id] } : {}), ...propios[id] });
  const cambiarGeneral = (cambio: Partial<Config>) => setGeneral((g) => ({ ...g, ...cambio }));
  const cambiarPropio = (id: number, cambio: Partial<Config>) => setPropios((p) => ({ ...p, [id]: { ...p[id], ...cambio } }));
  const quitarPropios = (id: number) =>
    setPropios((p) => {
      const { [id]: _quitado, ...resto } = p;
      return resto;
    });

  const propuestas: PropuestaCliente[] = clientes.map((c) => {
    const k = configDe(c.id);
    return {
      clienteNombre: c.nombre,
      unidades: c.filas,
      fecha: k.fecha,
      franja: !k.desde || !k.hasta ? '' : `De ${k.desde} a ${k.hasta} h`,
      tecnico: k.tecnico,
      contacto: k.contacto,
      queTenerListo: k.queTenerListo,
    };
  });
  const comun = { series };

  function imprimir(indices: number[]) {
    const malos = indices.filter((i) => horarioInvalido(configDe(clientes[i].id)));
    if (malos.length > 0) {
      setAviso(`Corregí el horario de ${malos.map((i) => clientes[i].nombre).join(', ')}: la hora final tiene que ser posterior a la inicial.`);
      return;
    }
    setAviso(imprimirPropuestas(indices.map((i) => propuestas[i]), comun) ? null : 'El navegador bloqueó la ventana. Permití las ventanas emergentes para este sitio y probá de nuevo.');
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-text">
          Propuesta de visita · {clientes.length} cliente{clientes.length === 1 ? '' : 's'}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => imprimir(clientes.map((_, i) => i))} disabled={clientes.length === 0}>
            PDF de todos ({clientes.length})
          </Button>
          <Button variant="ghost" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      </div>
      <p className="text-xs font-medium text-muted">
        Un documento por cliente, con sus unidades. No incluye las paradas de otros clientes ni coordenadas. Se abre para imprimir; elegí «Guardar como PDF».
        Los datos generales valen para todos; abrí un cliente para darle los suyos.
      </p>
      {aviso && <p className="text-sm font-semibold text-danger-700">{aviso}</p>}

      <div className="rounded-lg border border-neutral-200 p-3">
        <h3 className="mb-2 text-xs font-extrabold uppercase text-muted">Datos generales (para todos los documentos)</h3>
        <CamposConfig config={general} onCambio={cambiarGeneral} tecnicos={tecnicos.map((t) => t.nombre)} />
      </div>

      <div className="flex flex-col gap-3">
        {clientes.map((c, i) => {
          const cambios = Object.keys(propios[c.id] ?? {}).length;
          return (
            <details key={c.id} className="rounded-lg border border-neutral-200" open={clientes.length <= 2}>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm font-bold text-text">
                <span>
                  {c.nombre} · {c.filas.length} unidad{c.filas.length === 1 ? '' : 'es'}
                  {cambios > 0 && <span className="ml-2 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-600">datos propios</span>}
                </span>
                <span className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => imprimir([i])} className="text-xs font-bold text-primary-600">
                    PDF de este cliente
                  </button>
                </span>
              </summary>
              <div className="flex flex-col gap-3 border-t border-neutral-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase text-muted">Datos de este documento</span>
                  {cambios > 0 && (
                    <button type="button" onClick={() => quitarPropios(c.id)} className="text-xs font-bold text-primary-600">
                      Volver a los datos generales
                    </button>
                  )}
                </div>
                <CamposConfig config={configDe(c.id)} onCambio={(cambio) => cambiarPropio(c.id, cambio)} tecnicos={tecnicos.map((t) => t.nombre)} propios={propios[c.id]} />
              </div>
              <iframe title={`Vista previa ${c.nombre}`} srcDoc={propuestasHtml([propuestas[i]], comun)} className="h-[560px] w-full rounded-b-lg border-t border-neutral-200 bg-white" />
            </details>
          );
        })}
      </div>
    </Card>
  );
}

// Los seis campos de un documento. `propios` marca los que el cliente cambió respecto de lo general.
function CamposConfig({
  config,
  onCambio,
  tecnicos,
  propios,
}: {
  config: Config;
  onCambio: (cambio: Partial<Config>) => void;
  tecnicos: string[];
  propios?: Partial<Config>;
}) {
  const marca = (campo: keyof Config) => (propios && campo in propios ? <span className="text-primary-600"> · propio</span> : null);
  const invalido = horarioInvalido(config);
  // Si el técnico elegido ya no figura entre los activos se agrega igual, para que el desplegable no lo pierda.
  const opcionesTecnico = config.tecnico && !tecnicos.includes(config.tecnico) ? [config.tecnico, ...tecnicos] : tecnicos;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-bold text-muted">
          <span>Técnico{marca('tecnico')}</span>
          <Select value={config.tecnico} onChange={(e) => onCambio({ tecnico: e.target.value })}>
            <option value="">A designar</option>
            {opcionesTecnico.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted">
          <span>Día propuesto{marca('fecha')}</span>
          <Input type="date" value={config.fecha} onChange={(e) => onCambio({ fecha: e.target.value })} />
        </label>
        <div className="flex flex-col gap-1 text-xs font-bold text-muted">
          <span>
            Horario (de hora a hora){marca('desde') ?? marca('hasta')}
          </span>
          <div className="flex items-center gap-2">
            <Input type="time" step={900} value={config.desde} onChange={(e) => onCambio({ desde: e.target.value })} aria-label="Desde la hora" />
            <span>a</span>
            <Input type="time" step={900} value={config.hasta} onChange={(e) => onCambio({ hasta: e.target.value })} aria-label="Hasta la hora" />
          </div>
          {invalido && <span className="font-semibold text-danger-700">La hora final tiene que ser posterior a la inicial.</span>}
        </div>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted">
          <span>Contacto para confirmar{marca('contacto')}</span>
          <Input value={config.contacto} onChange={(e) => onCambio({ contacto: e.target.value })} placeholder="Teléfono o correo de coordinación" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs font-bold text-muted">
        <span>Qué tener listo (una línea por punto){marca('queTenerListo')}</span>
        <textarea
          value={config.queTenerListo}
          onChange={(e) => onCambio({ queTenerListo: e.target.value })}
          rows={3}
          className="w-full rounded-md bg-surface px-4 py-3 text-sm font-medium text-text shadow-inset outline-none"
        />
      </label>
    </div>
  );
}
