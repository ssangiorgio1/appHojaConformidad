'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Combobox } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/Input';
import { createRutaAcceso, deleteRutaAcceso, listRutasAcceso, listTerritorios, listUsuarios, previsualizarRutaAcceso, saveTerritorio, updateRutaAcceso } from '@/lib/api';
import type { RutaAcceso, TerritorioTecnico } from '@/lib/rutasAcceso';
import { DEPARTAMENTOS, DISTRITOS } from '@/lib/zonas';
import type { Usuario } from '@/lib/types';
import { COLORES_TECNICO } from './rutaMapa';
import sugeridasJson from '@/data/rutasSugeridas.json';

const RutasMapa = dynamic(() => import('./RutasMapa'), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-lg bg-neutral-100" />,
});

// Rutas importantes que salen de OpenStreetMap (accesos, corredores, costanera, rutas nacionales y provinciales): se
// ofrecen para agregarlas con un clic en lugar de marcarlas a mano. Ver routing/armar-rutas-sugeridas (script).
interface RutaSugerida {
  id: string;
  nombre: string;
  tipo: 'acceso' | 'corredor' | 'costanera' | 'variante' | 'circunvalacion' | 'nacional' | 'provincial';
  largoKm: number;
  puntos: Array<[number, number]>;
  /** El largo por las calles no coincide con el del mapa: mirarla antes de agregarla. */
  revisar?: boolean;
}
const SUGERIDAS = sugeridasJson as unknown as RutaSugerida[];
const TIPO_ETIQUETA: Record<RutaSugerida['tipo'], string> = {
  acceso: 'Accesos',
  corredor: 'Corredores',
  costanera: 'Costanera',
  variante: 'Variantes',
  circunvalacion: 'Circunvalaciones',
  nacional: 'Rutas nacionales',
  provincial: 'Rutas provinciales',
};
const TIPO_COLOR: Record<RutaSugerida['tipo'], string> = {
  acceso: COLORES_TECNICO[0],
  corredor: COLORES_TECNICO[3],
  costanera: COLORES_TECNICO[5],
  variante: COLORES_TECNICO[1],
  circunvalacion: COLORES_TECNICO[7],
  nacional: COLORES_TECNICO[4],
  provincial: COLORES_TECNICO[2],
};

// Dibujo de las rutas de acceso rápido y asignación de zonas (territorios) a cada técnico.
export function PlanificacionRutas() {
  const { getIdToken } = useAuth();
  const [rutas, setRutas] = useState<RutaAcceso[]>([]);
  const [territorios, setTerritorios] = useState<TerritorioTecnico[]>([]);
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [resaltada, setResaltada] = useState<string | null>(null);

  // Ruta en construcción (o en edición): se marcan sus puntos clave y el trazo por las calles llega calculado.
  const [dibujando, setDibujando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [puntos, setPuntos] = useState<Array<[number, number]>>([]);
  const [trazoNuevo, setTrazoNuevo] = useState<Array<[number, number]>>([]);
  const [kmNuevo, setKmNuevo] = useState<number | null>(null);
  const [porCalle, setPorCalle] = useState(true);
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState<string>(COLORES_TECNICO[0]);
  const [ancho, setAncho] = useState(3);
  const [guardando, setGuardando] = useState(false);

  // Rutas sugeridas: las elegidas para agregar y el trazo de la que se está mirando.
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [previa, setPrevia] = useState<Array<[number, number]>>([]);
  const [agregando, setAgregando] = useState(false);
  const trazosPrevia = useMemo(() => new Map<string, Array<[number, number]>>(), []);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const idToken = await getIdToken();
      const [r, t, u] = await Promise.all([listRutasAcceso(idToken), listTerritorios(idToken), listUsuarios(idToken)]);
      setRutas(r);
      setTerritorios(t);
      setTecnicos(u.filter((x) => x.role === 'tecnico' && x.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }, [getIdToken]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function accion(fn: (idToken: string) => Promise<unknown>): Promise<boolean> {
    setError(null);
    try {
      await fn(await getIdToken());
      await cargar();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }

  // Vista previa: con 2 puntos o más se pide a la API el trazo por las calles (con una pequeña espera por si se siguen marcando).
  useEffect(() => {
    if (!dibujando || puntos.length < 2) {
      setTrazoNuevo([]);
      setKmNuevo(null);
      return;
    }
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const r = await previsualizarRutaAcceso(await getIdToken(), puntos);
        if (cancelado) return;
        setTrazoNuevo(r.trazo);
        setKmNuevo(r.km);
        setPorCalle(r.porCalle);
        setError(null);
      } catch (err) {
        if (!cancelado) {
          setTrazoNuevo([]);
          setKmNuevo(null);
          setError(`No se pudo calcular el trazo por las calles: ${(err as Error).message}`);
        }
      }
    }, 450);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [dibujando, puntos, getIdToken]);

  function reiniciarDibujo() {
    setDibujando(false);
    setEditandoId(null);
    setPuntos([]);
    setTrazoNuevo([]);
    setKmNuevo(null);
  }

  function empezarDibujo() {
    reiniciarDibujo();
    setNombre('');
    setColor(COLORES_TECNICO[rutas.length % COLORES_TECNICO.length]);
    setDibujando(true);
  }

  function editarPuntos(r: RutaAcceso) {
    setEditandoId(r._id);
    setPuntos(r.puntos?.length >= 2 ? r.puntos : r.trazo.length > 1 ? [r.trazo[0], r.trazo[r.trazo.length - 1]] : []);
    setNombre(r.nombre);
    setColor(r.color);
    setAncho(r.anchoKm);
    setDibujando(true);
  }

  async function guardarRuta() {
    setGuardando(true);
    const cuerpo = { nombre: nombre.trim(), color, anchoKm: ancho, puntos, activa: true };
    const ok = await accion((t) => (editandoId ? updateRutaAcceso(t, editandoId, { ...cuerpo, activa: rutas.find((x) => x._id === editandoId)?.activa ?? true }) : createRutaAcceso(t, cuerpo)));
    setGuardando(false);
    if (ok) reiniciarDibujo();
  }

  // Las sugeridas que todavía no están guardadas (por nombre), agrupadas por tipo.
  const pendientes = useMemo(() => {
    const existentes = new Set(rutas.map((r) => r.nombre.toLowerCase()));
    return SUGERIDAS.filter((s) => !existentes.has(s.nombre.toLowerCase()));
  }, [rutas]);

  async function verSugerida(s: RutaSugerida | null) {
    if (!s) {
      setPrevia([]);
      return;
    }
    const guardado = trazosPrevia.get(s.id);
    if (guardado) {
      setPrevia(guardado);
      return;
    }
    try {
      const r = await previsualizarRutaAcceso(await getIdToken(), s.puntos);
      trazosPrevia.set(s.id, r.trazo);
      setPrevia(r.trazo);
    } catch {
      setPrevia(s.puntos);
    }
  }

  async function agregarElegidas() {
    setAgregando(true);
    let ok = true;
    for (const s of pendientes.filter((x) => elegidas.has(x.id))) {
      ok = (await accion((t) => createRutaAcceso(t, { nombre: s.nombre, color: TIPO_COLOR[s.tipo], anchoKm: 3, puntos: s.puntos, activa: true }))) && ok;
    }
    setAgregando(false);
    setPrevia([]);
    if (ok) setElegidas(new Set());
  }

  const puedeGuardar = puntos.length >= 2 && nombre.trim().length >= 2 && !guardando;
  const opcionesRutas = useMemo(() => rutas.map((r) => ({ value: r._id, label: r.nombre })), [rutas]);
  const opcionesDeptos = useMemo(() => DEPARTAMENTOS.map((d) => ({ value: d.nombre, label: d.nombre })), []);
  const opcionesDistritos = useMemo(() => DISTRITOS.map((d) => ({ value: d.clave, label: `${d.nombre} (${d.departamento})` })), []);

  return (
    <div className="flex flex-col gap-4">
      {error && <Card className="p-4 text-sm font-medium text-danger-700">{error}</Card>}
      <div className="flex items-start gap-4 max-lg:flex-col">
        <Card className="relative isolate z-0 min-w-0 flex-1 overflow-hidden p-1 max-lg:w-full">
          <RutasMapa rutas={rutas.filter((r) => r._id !== editandoId)} dibujando={dibujando} nuevo={puntos} trazoNuevo={trazoNuevo} previa={previa} colorNuevo={color} onPunto={(lng, lat) => setPuntos((t) => [...t, [Number(lng.toFixed(5)), Number(lat.toFixed(5))]])} resaltada={resaltada} />
        </Card>

        <Card className="flex w-full flex-col gap-3 p-4 lg:w-96">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-text">Rutas de acceso</h2>
            {!dibujando && <Button onClick={empezarDibujo}>Marcar una ruta</Button>}
          </div>

          {dibujando && (
            <div className="flex flex-col gap-2 rounded-lg border border-primary-600 p-3">
              <p className="text-xs font-medium text-muted">
                {editandoId ? 'Editando los puntos de la ruta. ' : ''}Hacé clic en el mapa para marcar los <strong>puntos clave</strong> del acceso (el inicio, el final y algún punto del medio),{' '}
                <strong>empezando por el lado de la oficina</strong>. El recorrido entre los puntos se calcula solo por las calles. Las unidades de la ruta se ordenan según ese sentido.
              </p>
              <Input placeholder="Nombre (ej. Acceso Este)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-bold text-muted">
                  Ancho (km)
                  <Input type="number" min={0.2} max={50} step={0.5} value={ancho} onChange={(e) => setAncho(Math.max(0.2, Number(e.target.value) || 3))} className="!w-20 !py-1.5" />
                </label>
                <span className="flex gap-1" role="radiogroup" aria-label="Color">
                  {COLORES_TECNICO.map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={color === c} onClick={() => setColor(c)} className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-text' : 'border-white'}`} style={{ backgroundColor: c }} aria-label={`Color ${c}`} />
                  ))}
                </span>
              </div>
              <p className="text-xs font-bold text-muted">
                {puntos.length} punto{puntos.length === 1 ? '' : 's'} marcado{puntos.length === 1 ? '' : 's'}
                {kmNuevo !== null ? ` · ${kmNuevo.toLocaleString('es-AR')} km ${porCalle ? 'por las calles' : '(en línea recta: el servicio de rutas no está configurado)'}` : puntos.length >= 2 ? ' · calculando el trazo…' : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void guardarRuta()} disabled={!puedeGuardar}>
                  {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Guardar ruta'}
                </Button>
                <Button variant="ghost" onClick={() => setPuntos((t) => t.slice(0, -1))} disabled={puntos.length === 0}>
                  Deshacer último punto
                </Button>
                <Button variant="ghost" onClick={reiniciarDibujo}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {cargando ? (
            <p className="text-sm text-muted">Cargando…</p>
          ) : rutas.length === 0 ? (
            <p className="text-sm text-muted">Todavía no hay rutas. Marcá la primera (Acceso Este, Acceso Sur, Costanera, Corredor del Oeste…): unos pocos puntos clave y el trazo sale solo.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rutas.map((r) => (
                <li key={r._id} onMouseEnter={() => setResaltada(r._id)} onMouseLeave={() => setResaltada(null)} className="flex flex-col gap-1.5 rounded-lg border border-neutral-200 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-text">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: r.color }} />
                      {r.nombre}
                    </span>
                    <span className="text-xs text-muted">{(r.puntos?.length ?? 0)} puntos</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-muted">
                    <label className="inline-flex items-center gap-1.5">
                      Ancho
                      <Input
                        type="number"
                        min={0.2}
                        max={50}
                        step={0.5}
                        defaultValue={r.anchoKm}
                        className="!w-16 !py-1"
                        onBlur={(e) => {
                          const v = Math.max(0.2, Number(e.target.value) || r.anchoKm);
                          if (v !== r.anchoKm) void accion((t) => updateRutaAcceso(t, r._id, { nombre: r.nombre, color: r.color, anchoKm: v, puntos: r.puntos, activa: r.activa }));
                        }}
                      />
                      km
                    </label>
                    <label className="inline-flex items-center gap-1.5">
                      <input type="checkbox" checked={r.activa} onChange={(e) => void accion((t) => updateRutaAcceso(t, r._id, { nombre: r.nombre, color: r.color, anchoKm: r.anchoKm, puntos: r.puntos, activa: e.target.checked }))} />
                      activa
                    </label>
                    <button type="button" className="text-primary-600" onClick={() => editarPuntos(r)}>
                      Editar puntos
                    </button>
                    <button
                      type="button"
                      className="text-danger-700"
                      onClick={() => {
                        if (window.confirm(`¿Borrar la ruta «${r.nombre}»? También se saca de los territorios que la tenían.`)) void accion((t) => deleteRutaAcceso(t, r._id));
                      }}
                    >
                      Borrar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {pendientes.length > 0 && (
        <Card className="flex flex-col gap-3 p-4">
          <div>
            <h2 className="text-base font-extrabold text-text">Rutas sugeridas de OpenStreetMap</h2>
            <p className="text-xs font-medium text-muted">
              Accesos, corredores, costanera y rutas nacionales y provinciales ya trazadas. Pasá el mouse por una para verla en el mapa, marcá las que quieras y agregalas: se guardan con su trazo por las calles y después las podés editar. Son datos de la comunidad de OpenStreetMap: revisalos.
            </p>
          </div>
          {(Object.keys(TIPO_ETIQUETA) as RutaSugerida['tipo'][]).map((tipo) => {
            const lista = pendientes.filter((s) => s.tipo === tipo);
            if (lista.length === 0) return null;
            return (
              <div key={tipo} className="flex flex-col gap-1.5">
                <span className="text-xs font-extrabold uppercase text-muted">{TIPO_ETIQUETA[tipo]}</span>
                <div className="flex flex-wrap gap-2">
                  {lista.map((s) => {
                    const on = elegidas.has(s.id);
                    return (
                      <label
                        key={s.id}
                        onMouseEnter={() => void verSugerida(s)}
                        onMouseLeave={() => void verSugerida(null)}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${on ? 'border-primary-600 bg-primary-50 text-text' : 'border-neutral-300 text-muted hover:text-text'}`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setElegidas((prev) => {
                              const next = new Set(prev);
                              if (next.has(s.id)) next.delete(s.id);
                              else next.add(s.id);
                              return next;
                            })
                          }
                        />
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TIPO_COLOR[s.tipo] }} />
                        {s.nombre} · {s.largoKm} km
                        {s.revisar ? <span title="El recorrido por las calles no coincide con el largo que figura en el mapa: miralá en el mapa antes de agregarla">⚠ revisar</span> : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void agregarElegidas()} disabled={elegidas.size === 0 || agregando}>
              {agregando ? 'Agregando…' : `Agregar las elegidas (${elegidas.size})`}
            </Button>
            <button type="button" className="text-xs font-bold text-primary-600" onClick={() => setElegidas(new Set(pendientes.map((s) => s.id)))}>
              Elegir todas
            </button>
            {elegidas.size > 0 && (
              <button type="button" className="text-xs font-bold text-primary-600" onClick={() => setElegidas(new Set())}>
                Quitar la selección
              </button>
            )}
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="text-base font-extrabold text-text">Territorios por técnico</h2>
          <p className="text-xs font-medium text-muted">
            Las zonas que se asignan acá quedan reservadas para ese técnico: al repartir visitas, sus unidades van con él y los demás técnicos reciben el resto. Una misma zona se puede dar a <strong>dos o más técnicos</strong>: sus unidades se reparten entre ellos según la cantidad que haya. Un técnico sin territorio se reparte con lo que no tiene dueño.
          </p>
        </div>
        {tecnicos.length === 0 && !cargando ? (
          <p className="text-sm text-muted">No hay técnicos activos.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {tecnicos.map((t) => (
              <FilaTerritorio
                key={t._id}
                tecnico={t}
                territorio={territorios.find((x) => x.tecnicoId === t._id) ?? null}
                opcionesRutas={opcionesRutas}
                opcionesDeptos={opcionesDeptos}
                opcionesDistritos={opcionesDistritos}
                onGuardar={(cuerpo) => accion((idToken) => saveTerritorio(idToken, t._id, { tecnicoNombre: t.nombre, ...cuerpo }))}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function FilaTerritorio({
  tecnico,
  territorio,
  opcionesRutas,
  opcionesDeptos,
  opcionesDistritos,
  onGuardar,
}: {
  tecnico: Usuario;
  territorio: TerritorioTecnico | null;
  opcionesRutas: Array<{ value: string; label: string }>;
  opcionesDeptos: Array<{ value: string; label: string }>;
  opcionesDistritos: Array<{ value: string; label: string }>;
  onGuardar: (cuerpo: { rutas: string[]; departamentos: string[]; distritos: string[] }) => Promise<boolean>;
}) {
  const [rutas, setRutas] = useState<string[]>(territorio?.rutas ?? []);
  const [deptos, setDeptos] = useState<string[]>(territorio?.departamentos ?? []);
  const [distritos, setDistritos] = useState<string[]>(territorio?.distritos ?? []);
  const [guardando, setGuardando] = useState(false);
  const igual = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const cambiado = !igual(rutas, territorio?.rutas ?? []) || !igual(deptos, territorio?.departamentos ?? []) || !igual(distritos, territorio?.distritos ?? []);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 p-3">
      <span className="w-40 text-sm font-bold text-text">{tecnico.nombre}</span>
      <Combobox ariaLabel={`Rutas de ${tecnico.nombre}`} placeholder="Rutas" etiquetaPlural="rutas" buscarPlaceholder="Buscar ruta…" values={rutas} onChange={setRutas} opciones={opcionesRutas} />
      <Combobox ariaLabel={`Departamentos de ${tecnico.nombre}`} placeholder="Departamentos" etiquetaPlural="departamentos" buscarPlaceholder="Buscar departamento…" values={deptos} onChange={setDeptos} opciones={opcionesDeptos} />
      <Combobox ariaLabel={`Distritos de ${tecnico.nombre}`} placeholder="Distritos" etiquetaPlural="distritos" buscarPlaceholder="Buscar distrito…" values={distritos} onChange={setDistritos} opciones={opcionesDistritos} />
      <Button
        disabled={!cambiado || guardando}
        onClick={async () => {
          setGuardando(true);
          await onGuardar({ rutas, departamentos: deptos, distritos });
          setGuardando(false);
        }}
      >
        {guardando ? 'Guardando…' : 'Guardar'}
      </Button>
    </div>
  );
}
