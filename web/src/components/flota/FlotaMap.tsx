'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { FlotaUnidad } from '@/lib/types';
import { bo3DiagnosticoUrl } from '@/lib/bo3';
import { FLOTA_CATEGORIA_COLOR, FLOTA_CATEGORIA_LABEL } from './categorias';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function popupHtml(u: FlotaUnidad): string {
  const reporte = u.ultimoReporte
    ? new Date(u.ultimoReporte * 1000).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false })
    : 'nunca reportó';
  return [
    `<strong>${esc(u.clienteNombre ?? `Cliente #${u.clienteId}`)}</strong>`,
    `Unidad: ${esc(u.nombre)}`,
    u.matricula ? `Patente: ${esc(u.matricula)}` : '',
    u.interno ? `Interno: ${esc(u.interno)}` : '',
    `Último reporte: ${esc(reporte)}`,
    '<span style="color:#6b7280;font-size:11px">Dato de la última actualización del mapa; el estado del equipo se consulta en vivo.</span>',
    `Estado: ${esc(FLOTA_CATEGORIA_LABEL[u.categoria] ?? u.categoria)}`,
    u.equipoId ? `<a href="#" data-equipo="${u.equipoId}"><strong>Ver estado del equipo →</strong></a>` : '',
    u.equipoId ? `<a href="${bo3DiagnosticoUrl(u.equipoId)}" target="_blank" rel="noopener noreferrer">Abrir en bo3 ↗</a>` : '',
  ]
    .filter(Boolean)
    .join('<br>');
}

// 20k puntos: canvas (no SVG) y popup creado recién al hacer clic, no uno por marcador.
export interface AreaSeleccionada {
  norte: number;
  sur: number;
  este: number;
  oeste: number;
}

const RECT_ESTILO = { color: '#2563eb', weight: 2, fillOpacity: 0.08, interactive: false };

export default function FlotaMap({
  unidades,
  onInspectEquipo,
  seleccionando = false,
  area = null,
  onArea,
  enfocarClave = '',
}: {
  unidades: FlotaUnidad[];
  /** Al cambiar, el mapa se reencuadra sobre las unidades mostradas. */
  enfocarClave?: string;
  onInspectEquipo?: (equipoId: number) => void;
  /** Modo selección: arrastrar dibuja un rectángulo (espacio apretado = mover el mapa). */
  seleccionando?: boolean;
  area?: AreaSeleccionada | null;
  onArea?: (area: AreaSeleccionada | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.FeatureGroup | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  // Renderer SVG propio para los rectángulos de selección: si no, Leaflet (preferCanvas) crea un 2.º canvas
  // cuyo manejador de clics dispara un "clic en el mapa" que cierra el popup recién abierto de la unidad.
  const rectRendererRef = useRef<L.SVG | null>(null);
  const unidadPorMarcador = useRef(new Map<L.Layer, FlotaUnidad>());
  const fittedRef = useRef(false);
  const enfocadoRef = useRef(enfocarClave);
  const inspectRef = useRef(onInspectEquipo);
  const areaCbRef = useRef(onArea);
  const rectRef = useRef<L.Rectangle | null>(null);
  // true justo después de soltar un arrastre de selección: ese "clic" no debe abrir el popup de una unidad.
  const ignorarClicRef = useRef(false);
  useEffect(() => {
    inspectRef.current = onInspectEquipo;
    areaCbRef.current = onArea;
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { preferCanvas: true }).setView([-33, -66], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    // Un solo renderer canvas para toda la vida del mapa y un único manejador de clic delegado
    // (en vez de un listener + un canvas nuevo por cada actualización de filtros).
    rendererRef.current = L.canvas({ padding: 0.5 });
    rectRendererRef.current = L.svg({ padding: 0.5 });
    layerRef.current = L.featureGroup().addTo(map);
    layerRef.current.on('click', (e: L.LeafletEvent) => {
      const ev = e as L.LeafletMouseEvent & { propagatedFrom?: L.Layer };
      const u = ev.propagatedFrom ? unidadPorMarcador.current.get(ev.propagatedFrom) : undefined;
      if (u && !ignorarClicRef.current) L.popup().setLatLng(ev.latlng).setContent(popupHtml(u)).openOn(map);
    });
    mapRef.current = map;

    // El popup se arma como HTML suelto: el enlace "Ver estado del equipo" se engancha al abrirse.
    map.on('popupopen', (e) => {
      const link = e.popup.getElement()?.querySelector<HTMLAnchorElement>('a[data-equipo]');
      link?.addEventListener('click', (ev) => {
        ev.preventDefault();
        inspectRef.current?.(Number(link.dataset.equipo));
      });
    });

    // Al abrir/cerrar el panel lateral el mapa cambia de ancho: Leaflet necesita recalcular su tamaño.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      rendererRef.current = null;
      rectRendererRef.current = null;
    };
  }, []);

  // Modo selección de área: arrastrar dibuja un rectángulo (se avisa a la página recién al soltar,
  // así no se recalcula la tabla en cada movimiento). Con la barra espaciadora apretada el mapa
  // se puede mover.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !seleccionando) return;
    const container = map.getContainer();
    let espacio = false;
    const cursor = () => {
      container.style.cursor = espacio ? 'grab' : 'crosshair';
    };
    cursor();
    map.dragging.disable();
    let inicio: L.LatLng | null = null;
    let inicioPx: L.Point | null = null;
    let arrastrando = false;
    let rect: L.Rectangle | null = null;
    // Un clic (sobre una unidad, por ejemplo) no es un arrastre: hasta que el mouse se mueve unos
    // píxeles no se toca el área ya marcada ni se dibuja nada, así el clic llega al marcador.
    const UMBRAL_PX = 5;
    const onDown = (e: L.LeafletMouseEvent) => {
      if (espacio) return;
      inicio = e.latlng;
      inicioPx = e.containerPoint;
      arrastrando = false;
    };
    const onMove = (e: L.LeafletMouseEvent) => {
      if (!inicio || !inicioPx) return;
      if (!arrastrando) {
        if (e.containerPoint.distanceTo(inicioPx) < UMBRAL_PX) return;
        arrastrando = true;
        areaCbRef.current?.(null);
      }
      const b = L.latLngBounds(inicio, e.latlng);
      if (rect) rect.setBounds(b);
      else rect = L.rectangle(b, { ...RECT_ESTILO, renderer: rectRendererRef.current! }).addTo(map);
    };
    const onUp = (e: L.LeafletMouseEvent) => {
      if (!inicio) return;
      const b = L.latLngBounds(inicio, e.latlng);
      const huboArrastre = arrastrando;
      if (huboArrastre) {
        ignorarClicRef.current = true;
        setTimeout(() => (ignorarClicRef.current = false), 0);
      }
      inicio = null;
      inicioPx = null;
      arrastrando = false;
      rect?.remove();
      rect = null;
      // Un clic suelto (sin arrastre) no define un área ni borra la anterior.
      if (!huboArrastre || b.getNorth() === b.getSouth() || b.getEast() === b.getWest()) return;
      areaCbRef.current?.({ norte: b.getNorth(), sur: b.getSouth(), este: b.getEast(), oeste: b.getWest() });
    };
    const enCampo = (t: EventTarget | null) => t instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(t.tagName);
    const onKeyDown = (e: KeyboardEvent) => {
      if (enCampo(e.target)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!espacio) {
          espacio = true;
          map.dragging.enable();
          cursor();
        }
      } else if (e.key === 'Escape') {
        areaCbRef.current?.(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      espacio = false;
      map.dragging.disable();
      cursor();
    };
    map.on('mousedown', onDown);
    map.on('mousemove', onMove);
    map.on('mouseup', onUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      map.off('mousedown', onDown);
      map.off('mousemove', onMove);
      map.off('mouseup', onUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      rect?.remove();
      map.dragging.enable();
      container.style.cursor = '';
    };
  }, [seleccionando]);

  // El rectángulo definitivo se dibuja a partir de `area` (también cuando se limpia desde afuera).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    rectRef.current?.remove();
    rectRef.current = null;
    if (!area) return;
    rectRef.current = L.rectangle(
      [
        [area.sur, area.oeste],
        [area.norte, area.este],
      ],
      { ...RECT_ESTILO, renderer: rectRendererRef.current! },
    ).addTo(map);
  }, [area]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    unidadPorMarcador.current.clear();
    const renderer = rendererRef.current!;
    // Opciones de estilo compartidas por categoría (no un objeto nuevo por marcador).
    const estilos = new Map<string, L.CircleMarkerOptions>();
    for (const u of unidades) {
      let opts = estilos.get(u.categoria);
      if (!opts) {
        const color = FLOTA_CATEGORIA_COLOR[u.categoria] ?? '#9ca3af';
        opts = { renderer, radius: 5, weight: 1, color, fillColor: color, fillOpacity: 0.85 };
        estilos.set(u.categoria, opts);
      }
      const marcador = L.circleMarker([u.latitud, u.longitud], opts);
      unidadPorMarcador.current.set(marcador, u);
      layer.addLayer(marcador);
    }
    // Reencuadra al cargar por primera vez y cada vez que cambia `enfocarClave` (ej. otro cliente).
    if ((!fittedRef.current || enfocadoRef.current !== enfocarClave) && unidades.length > 0) {
      const bounds = L.latLngBounds(unidades.map((u) => [u.latitud, u.longitud] as [number, number]));
      map.fitBounds(bounds.pad(0.05), { maxZoom: 11 });
      fittedRef.current = true;
      enfocadoRef.current = enfocarClave;
    }
  }, [unidades, enfocarClave]);

  return <div ref={containerRef} className="h-[60vh] min-h-[360px] w-full rounded-lg lg:h-[calc(100vh-15rem)] lg:min-h-[420px]" />;
}
