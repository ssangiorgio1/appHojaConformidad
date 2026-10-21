'use client';

import { geoBounds, geoCentroid, geoCircle, geoMercator } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ChoroplethChart, ChoroplethFeatureComponent, type ChoroplethFeatureProperties } from '@/components/charts/choropleth';
import { useChoroplethStable, useChoroplethZoom } from '@/components/charts/choropleth/choropleth-context';
import type { FlotaUnidad } from '@/lib/types';
import { OFICINA, RADIOS_KM } from '@/lib/oficina';
import type { RutaMapa } from './rutaMapa';
import { DEPARTAMENTOS_GEOJSON, zonasVisibles, type ZonaFeature } from '@/lib/zonas';
import { FLOTA_CATEGORIA_COLOR, FLOTA_CATEGORIA_LABEL } from './categorias';
import { colorZona } from './FlotaZonasMap';

// El componente de bklit espera `properties.name`/`id`; el resto de las propiedades viajan para los clics.
function aDatos(zonas: ZonaFeature[]): FeatureCollection<Geometry, ChoroplethFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: zonas.map((z) => ({
      type: 'Feature',
      properties: { name: z.nombre, id: z.id, tipo: z.tipo, departamento: z.departamento, contexto: z.contexto },
      geometry: z.geometry,
    })),
  };
}

const COLOR_CONTEXTO = '#e5e7eb';

// Radio de los puntos en pantalla = RADIO_POR_NIVEL * zoom^(1 - EXPONENTE_CONTRA_ZOOM): con 1 quedarían fijos en
// píxeles (se ven más chicos a medida que el mapa crece); con 0.4 crecen suave al acercar.
// Tamaño base según lo acercado que está el encuadre: al elegir un departamento o un distrito el mapa
// se acerca a él y los puntos tienen que crecer con eso.
const RADIO_POR_NIVEL = { provincia: 3, departamento: 4.5, distrito: 7 } as const;
const EXPONENTE_CONTRA_ZOOM = 0.4;

interface CapaProps {
  valores: Map<string, number>;
  seleccion: string | null;
  distritoSel: string | null;
  verRadios: boolean;
  rutas: RutaMapa[];
  unidades: FlotaUnidad[];
  onInspectEquipo?: (equipoId: number) => void;
}

// Capa propia dentro del SVG del gráfico: contorno del departamento elegido, nombre y valor de cada
// departamento (los chicos no, para que no se pisen) y las unidades como puntos. El tamaño de
// letras y puntos se divide por el zoom para que no crezcan al acercar.
const ZonaCapa = memo(function ZonaCapa({ valores, seleccion, distritoSel, verRadios, rutas, unidades, onInspectEquipo }: CapaProps) {
  const { features, featurePaths, projectPoint, rawPathGenerator } = useChoroplethStable();
  const { zoom } = useChoroplethZoom();
  const k = zoom?.transformMatrix.scaleX ?? 1;

  const etiquetas = useMemo(() => {
    const out: { id: string; nombre: string; x: number; y: number; ancho: number }[] = [];
    for (const f of features) {
      if (f.properties.contexto) continue;
      const id = String(f.properties.id);
      const nombre = String(f.properties.name);
      const c = projectPoint(geoCentroid(f) as [number, number]);
      const [[oeste, sur], [este, norte]] = geoBounds(f);
      const a = projectPoint([oeste, norte]);
      const b = projectPoint([este, sur]);
      if (!c || !a || !b) continue;
      out.push({ id, nombre, x: c[0], y: c[1], ancho: Math.abs(b[0] - a[0]) });
    }
    return out;
  }, [features, projectPoint]);

  const puntos = useMemo(() => {
    const out: { u: FlotaUnidad; x: number; y: number }[] = [];
    for (const u of unidades) {
      const p = projectPoint([u.longitud, u.latitud]);
      if (p) out.push({ u, x: p[0], y: p[1] });
    }
    return out;
  }, [unidades, projectPoint]);

  // Contorno oscuro: el departamento elegido (aunque se dibuje como distritos) y, más fino, el distrito.
  const trazoDepto = useMemo(() => {
    const d = seleccion ? DEPARTAMENTOS_GEOJSON.features.find((f) => f.properties.nombre === seleccion) : null;
    return d ? rawPathGenerator(d) : null;
  }, [seleccion, rawPathGenerator]);
  // Círculos de las zonas por radio alrededor de la oficina (1° de arco ≈ 111,195 km).
  const radios = useMemo(() => {
    if (!verRadios) return [];
    return RADIOS_KM.map((km) => {
      const circulo = geoCircle().center([OFICINA.longitud, OFICINA.latitud]).radius(km / 111.195).precision(1)();
      const norte = projectPoint([OFICINA.longitud, OFICINA.latitud + km / 111.195]);
      return { km, trazo: rawPathGenerator(circulo), etiqueta: norte };
    });
  }, [verRadios, rawPathGenerator, projectPoint]);
  // Traza del recorrido por calle y sus paradas numeradas.
  const trazasRutas = useMemo(
    () =>
      rutas.map((r) => ({
        color: r.color,
        etiqueta: r.etiqueta,
        trazo: r.geometria.length > 1 ? rawPathGenerator({ type: 'LineString', coordinates: r.geometria }) : null,
        paradas: r.paradas.flatMap((p) => {
          const xy = projectPoint([p.longitud, p.latitud]);
          return xy ? [{ ...p, x: xy[0], y: xy[1] }] : [];
        }),
      })),
    [rutas, rawPathGenerator, projectPoint],
  );
  const centroOficina = verRadios || rutas.length > 0 ? projectPoint([OFICINA.longitud, OFICINA.latitud]) : null;

  const idxDistrito = distritoSel ? features.findIndex((f) => f.properties.id === distritoSel) : -1;
  const trazoDistrito = idxDistrito >= 0 ? featurePaths[idxDistrito] : null;
  const idxDepto = seleccion ? features.findIndex((f) => f.properties.id === seleccion && !f.properties.contexto) : -1;
  const trazoSel = trazoDepto ?? (idxDepto >= 0 ? featurePaths[idxDepto] : null);

  return (
    <g>
      {radios.map((r) =>
        r.trazo ? (
          <g key={r.km} pointerEvents="none">
            <path d={r.trazo} fill="none" stroke="#9D273C" strokeDasharray={`${6 / k} ${4 / k}`} strokeWidth={1.5 / k} />
            {r.etiqueta && (
              <text x={r.etiqueta[0]} y={r.etiqueta[1] - 3 / k} fill="#9D273C" fontSize={11 / k} fontWeight={700} textAnchor="middle" stroke="#fff" strokeWidth={3 / k} paintOrder="stroke">
                {r.km} km
              </text>
            )}
          </g>
        ) : null,
      )}
      {centroOficina && (
        <g pointerEvents="none">
          <circle cx={centroOficina[0]} cy={centroOficina[1]} r={6 / k} fill="#9D273C" stroke="#fff" strokeWidth={2 / k} />
          <text x={centroOficina[0]} y={centroOficina[1] + 18 / k} fill="#9D273C" fontSize={11 / k} fontWeight={700} textAnchor="middle" stroke="#fff" strokeWidth={3 / k} paintOrder="stroke">
            Oficina
          </text>
        </g>
      )}
      {trazoSel && <path d={trazoSel} fill="none" pointerEvents="none" stroke="#111827" strokeWidth={2 / k} />}
      {trazoDistrito && <path d={trazoDistrito} fill="none" pointerEvents="none" stroke="#111827" strokeWidth={3 / k} />}
      <g pointerEvents="none" fontSize={11 / k} textAnchor="middle" fontWeight={700}>
        {etiquetas.map((e) => {
          if (e.ancho * k < 70) return null;
          const n = valores.get(e.id) ?? 0;
          return (
            <text key={e.id} x={e.x} y={e.y} fill="#111827" stroke="#fff" strokeWidth={3 / k} paintOrder="stroke">
              <tspan x={e.x}>{e.nombre}</tspan>
              <tspan x={e.x} dy={13 / k} fontWeight={500}>
                {n.toLocaleString('es-AR')}
              </tspan>
            </text>
          );
        })}
      </g>
      {puntos.map(({ u, x, y }) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: punto del mapa
        <circle
          key={u.movilId}
          cx={x}
          cy={y}
          r={RADIO_POR_NIVEL[distritoSel ? 'distrito' : seleccion ? 'departamento' : 'provincia'] / k ** EXPONENTE_CONTRA_ZOOM}
          fill={FLOTA_CATEGORIA_COLOR[u.categoria] ?? '#9ca3af'}
          stroke="#fff"
          strokeWidth={(distritoSel ? 1.2 : 0.8) / k}
          className={u.equipoId ? 'cursor-pointer' : undefined}
          onClick={(e) => {
            e.stopPropagation();
            if (u.equipoId) onInspectEquipo?.(u.equipoId);
          }}
        >
          <title>
            {`${u.clienteNombre ?? `Cliente #${u.clienteId}`}\n${u.nombre}${u.matricula ? ` · ${u.matricula}` : ''}\n${FLOTA_CATEGORIA_LABEL[u.categoria]}`}
          </title>
        </circle>
      ))}
      {trazasRutas.map((r) =>
        r.trazo ? (
          <g key={`traza-${r.etiqueta}`} pointerEvents="none" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={r.trazo} stroke="#fff" strokeWidth={7 / k} />
            <path d={r.trazo} stroke={r.color} strokeWidth={4 / k} />
          </g>
        ) : null,
      )}
      {trazasRutas.flatMap((r) =>
        r.paradas.map((p) => (
          <g key={`${r.etiqueta}-${p.posicion}`}>
            <title>{p.titulo}</title>
            <circle cx={p.x} cy={p.y} r={10 / k} fill={r.color} stroke="#fff" strokeWidth={2 / k} />
            <text x={p.x} y={p.y + 4 / k} fill="#fff" fontSize={11 / k} fontWeight={700} textAnchor="middle" pointerEvents="none">
              {p.posicion}
            </text>
          </g>
        )),
      )}
    </g>
  );
});
ZonaCapa.displayName = 'ChoroplethZonaCapa';

export default function FlotaZonasBklit({
  valores,
  seleccion,
  distritoSel = null,
  onZona,
  verRadios = false,
  rutas = [],
  unidades = [],
  onInspectEquipo,
}: {
  /** Valor a pintar por id de zona (nombre del departamento o clave del distrito). */
  valores: Map<string, number>;
  seleccion: string | null;
  distritoSel?: string | null;
  onZona: (zona: ZonaFeature) => void;
  /** Dibuja los círculos de las zonas por radio alrededor de la oficina. */
  verRadios?: boolean;
  /** Recorridos por calle a dibujar (uno por técnico: traza y paradas numeradas). */
  rutas?: RutaMapa[];
  unidades?: FlotaUnidad[];
  onInspectEquipo?: (equipoId: number) => void;
}) {
  const contRef = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = contRef.current;
    if (!el) return;
    const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zonas = useMemo(() => zonasVisibles(seleccion), [seleccion]);
  const datos = useMemo(() => aDatos(zonas), [zonas]);
  // El máximo se toma solo entre lo que se pinta con color (no entre los departamentos de contexto).
  const maximo = useMemo(() => Math.max(0, ...zonas.filter((z) => !z.contexto).map((z) => valores.get(z.id) ?? 0)), [zonas, valores]);

  // Proyección que encuadra toda la provincia o, con una zona elegida, solo ese departamento.
  const encuadre = useMemo(() => {
    if (tam.w < 10 || tam.h < 10) return null;
    // Se encuadra el distrito elegido, el departamento elegido (sus distritos) o toda la provincia.
    const elegidos = distritoSel
      ? datos.features.filter((f) => f.properties.id === distritoSel)
      : seleccion
        ? datos.features.filter((f) => !f.properties.contexto)
        : datos.features;
    // Con un recorrido dibujado se encuadra la traza completa (y la oficina de la que sale).
    const trazas = rutas.filter((r) => r.geometria.length > 1);
    const objetivo = trazas.length > 0
      ? { type: 'Feature' as const, properties: {}, geometry: { type: 'MultiLineString' as const, coordinates: trazas.map((r) => r.geometria) } }
      : { ...datos, features: elegidos };
    const pad = seleccion ? 32 : 16;
    const proj = geoMercator().fitExtent(
      [
        [pad, pad],
        [tam.w - pad, tam.h - pad],
      ],
      objetivo,
    );
    return { scale: proj.scale(), translate: proj.translate() as [number, number] };
  }, [tam, seleccion, distritoSel, datos, rutas]);

  return (
    <div ref={contRef} className="h-[60vh] min-h-[360px] w-full overflow-hidden rounded-lg bg-neutral-50 lg:h-[calc(100vh-15rem)] lg:min-h-[420px]">
      {encuadre && (
        <ChoroplethChart
          key={`${seleccion ?? 'provincia'}|${distritoSel ?? ''}|${rutas.length > 0 ? 'ruta' : ''}`}
          data={datos}
          aspectRatio="auto"
          className="h-full"
          center={[0, 0]}
          scale={encuadre.scale}
          translate={encuadre.translate}
          animationDuration={400}
          zoomEnabled
          zoomMin={0.8}
          zoomMax={12}
        >
          <ChoroplethFeatureComponent
            stroke="#ffffff"
            strokeWidth={1}
            fadedOpacity={0.6}
            getFeatureColor={(f) => (f.properties.contexto ? COLOR_CONTEXTO : colorZona(valores.get(String(f.properties.id)) ?? 0, maximo))}
            onFeatureClick={(f) => {
              const z = zonas.find((x) => x.id === f.properties.id);
              if (z) onZona(z);
            }}
          />
          <ZonaCapa valores={valores} seleccion={seleccion} distritoSel={distritoSel} verRadios={verRadios} rutas={rutas} unidades={unidades} onInspectEquipo={onInspectEquipo} />
        </ChoroplethChart>
      )}
    </div>
  );
}
