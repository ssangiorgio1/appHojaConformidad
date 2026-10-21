'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './leafletParche';
import { useEffect, useRef } from 'react';
import type { FlotaUnidad } from '@/lib/types';
import { OFICINA, RADIOS_KM } from '@/lib/oficina';
import { zonasVisibles, type ZonaFeature } from '@/lib/zonas';
import type { RutaMapa } from './rutaMapa';
import { FLOTA_CATEGORIA_COLOR } from './categorias';
import { popupHtml } from './FlotaMap';
import { sateliteEsri } from './sateliteEsri';

// Escala secuencial de un solo tono: más oscuro = más. El cero queda casi transparente.
const RAMPA = ['#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e3a8a'];

export function colorZona(valor: number, maximo: number): string {
  if (valor <= 0 || maximo <= 0) return '#f3f4f6';
  const i = Math.min(RAMPA.length - 1, Math.floor((valor / maximo) * RAMPA.length));
  return RAMPA[i];
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Etiqueta con halo blanco para que se lea sobre el mapa, el satélite y las zonas pintadas.
function etiquetaHtml(nombre: string, valor: number | null): string {
  const halo = '-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff,0 0 3px #fff';
  return `<div style="transform:translate(-50%,-50%);text-align:center;white-space:nowrap;pointer-events:none;line-height:1.15;color:#111827;text-shadow:${halo}">
    <div style="font:700 11px 'Segoe UI',Arial,sans-serif">${esc(nombre)}</div>
    ${valor === null ? '' : `<div style="font:500 11px 'Segoe UI',Arial,sans-serif">${valor.toLocaleString('es-AR')}</div>`}</div>`;
}

export default function FlotaZonasMap({
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
  /** Unidades de la zona elegida: se dibujan como puntos sobre el departamento. */
  unidades?: FlotaUnidad[];
  onInspectEquipo?: (equipoId: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const capaRef = useRef<L.GeoJSON | null>(null);
  const etiquetasRef = useRef<{ quitar: () => void } | null>(null);
  const encuadradoRef = useRef(false);
  const puntosRef = useRef<L.FeatureGroup | null>(null);
  const unidadPorMarcador = useRef(new Map<L.Layer, FlotaUnidad>());
  const zonaCbRef = useRef(onZona);
  const inspectRef = useRef(onInspectEquipo);
  useEffect(() => {
    zonaCbRef.current = onZona;
    inspectRef.current = onInspectEquipo;
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { preferCanvas: true, maxZoom: 21 }).setView([-34.6, -68.6], 7);
    // Bases de mapa sin clave: OpenStreetMap, calles de Esri y satélite de Esri (con nombres de calles encima).
    const esri = (capa: string) => `https://server.arcgisonline.com/ArcGIS/rest/services/${capa}/MapServer/tile/{z}/{y}/{x}`;
    const atribEsri = 'Tiles &copy; Esri';
    const calles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxNativeZoom: 19,
      maxZoom: 21,
    }).addTo(map);
    const callesEsri = L.tileLayer(esri('World_Street_Map'), { attribution: atribEsri, maxNativeZoom: 19, maxZoom: 21 });
    // Satélite que no se corta al acercar mucho: ver sateliteEsri.ts. Las etiquetas se estiran desde el zoom 17.
    const satelite = L.layerGroup([
      sateliteEsri(),
      L.tileLayer(esri('Reference/World_Transportation'), { maxNativeZoom: 17, maxZoom: 21 }),
      L.tileLayer(esri('Reference/World_Boundaries_and_Places'), { maxNativeZoom: 17, maxZoom: 21 }),
    ]);
    L.control.layers({ Calles: calles, 'Calles (Esri)': callesEsri, Satélite: satelite }, undefined, { position: 'topright' }).addTo(map);
    // Polígonos y puntos comparten un solo canvas (clic al elemento de más arriba) y un único
    // manejador de clic delegado para los puntos, como en el mapa de unidades.
    puntosRef.current = L.featureGroup().addTo(map);
    puntosRef.current.on('click', (e: L.LeafletEvent) => {
      const ev = e as L.LeafletMouseEvent & { propagatedFrom?: L.Layer };
      const u = ev.propagatedFrom ? unidadPorMarcador.current.get(ev.propagatedFrom) : undefined;
      if (u) L.popup().setLatLng(ev.latlng).setContent(popupHtml(u)).openOn(map);
    });
    map.on('popupopen', (e) => {
      const link = e.popup.getElement()?.querySelector<HTMLAnchorElement>('a[data-equipo]');
      link?.addEventListener('click', (ev) => {
        ev.preventDefault();
        inspectRef.current?.(Number(link.dataset.equipo));
      });
    });
    mapRef.current = map;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      capaRef.current = null;
      etiquetasRef.current = null;
      puntosRef.current = null;
    };
  }, []);

  // La capa se rearma cuando cambian los valores o la selección (como mucho unas pocas decenas de
  // polígonos: los departamentos, o los distritos del elegido más los demás departamentos).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    capaRef.current?.remove();
    const zonas = zonasVisibles(seleccion);
    const maximo = Math.max(0, ...zonas.filter((z) => !z.contexto).map((z) => valores.get(z.id) ?? 0));
    const datos = {
      type: 'FeatureCollection',
      features: zonas.map((z) => ({
        type: 'Feature',
        properties: { id: z.id, nombre: z.nombre, contexto: z.contexto, distrito: z.tipo === 'distrito' },
        geometry: z.geometry,
      })),
    } as GeoJSON.FeatureCollection;
    const capa = L.geoJSON(datos, {
      style: (f) => {
        const id = f?.properties?.id as string;
        const elegido = id === (distritoSel ?? seleccion) && !f?.properties?.contexto;
        if (f?.properties?.contexto) return { color: '#9ca3af', weight: 1, fillColor: '#e5e7eb', fillOpacity: 0.35 };
        return {
          color: elegido ? '#111827' : '#6b7280',
          weight: elegido ? 3 : 1,
          fillColor: colorZona(valores.get(id) ?? 0, maximo),
          fillOpacity: 0.55,
        };
      },
      onEachFeature: (f, layer) => {
        const z = zonas.find((x) => x.id === f.properties.id);
        if (z) layer.on('click', () => zonaCbRef.current(z));
      },
    }).addTo(map);
    capa.bringToBack();
    capaRef.current = capa;

    // Nombre y cantidad sobre cada zona, solo en las que se ven lo bastante grandes (si no se pisan).
    etiquetasRef.current?.quitar();
    const items: { id: string; nombre: string; bounds: L.LatLngBounds }[] = [];
    capa.eachLayer((l) => {
      const p = (l as L.GeoJSON & { feature?: { properties: { id: string; nombre: string; contexto: boolean } } }).feature?.properties;
      if (!p || p.contexto) return;
      items.push({ id: p.id, nombre: p.nombre, bounds: (l as L.Polygon).getBounds() });
    });
    const grupo = L.layerGroup().addTo(map);
    const pintar = () => {
      grupo.clearLayers();
      const vista = map.getBounds();
      for (const it of items) {
        if (!vista.intersects(it.bounds)) continue;
        const a = map.latLngToContainerPoint(it.bounds.getNorthWest());
        const b = map.latLngToContainerPoint(it.bounds.getSouthEast());
        if (Math.abs(b.x - a.x) < 70 || Math.abs(b.y - a.y) < 30) continue;
        L.marker(it.bounds.getCenter(), {
          icon: L.divIcon({ className: '', html: etiquetaHtml(it.nombre, valores.get(it.id) ?? 0), iconSize: [0, 0] }),
          interactive: false,
          keyboard: false,
        }).addTo(grupo);
      }
    };
    map.on('zoomend moveend', pintar);
    pintar();
    etiquetasRef.current = {
      quitar: () => {
        map.off('zoomend moveend', pintar);
        grupo.remove();
      },
    };
  }, [valores, seleccion, distritoSel]);

  // Al elegir un departamento (o un distrito) se encuadra sobre él; al soltarlo, vuelve a toda la provincia.
  useEffect(() => {
    const map = mapRef.current;
    const capa = capaRef.current;
    if (!map || !capa) return;
    if (!seleccion) {
      if (encuadradoRef.current) map.fitBounds(capa.getBounds().pad(0.03));
      return;
    }
    const grupo = L.featureGroup();
    capa.eachLayer((l) => {
      const p = (l as L.GeoJSON & { feature?: { properties: { id: string; contexto: boolean } } }).feature?.properties;
      if (!p || p.contexto) return;
      if (!distritoSel || p.id === distritoSel) grupo.addLayer(l);
    });
    if (grupo.getLayers().length > 0) map.fitBounds(grupo.getBounds().pad(0.05));
  }, [seleccion, distritoSel]);

  // Círculos de las zonas por radio alrededor de la oficina, con su distancia y la oficina marcada.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !verRadios) return;
    const grupo = L.layerGroup().addTo(map);
    const centro = L.latLng(OFICINA.latitud, OFICINA.longitud);
    for (const km of RADIOS_KM) {
      L.circle(centro, { radius: km * 1000, color: '#9D273C', weight: 1.5, dashArray: '6 4', fill: false, interactive: false }).addTo(grupo);
      // La etiqueta va en el punto más al norte del círculo.
      const norte = L.latLng(OFICINA.latitud + km / 111.195, OFICINA.longitud);
      L.marker(norte, {
        icon: L.divIcon({ className: '', html: etiquetaHtml(`${km} km`, null), iconSize: [0, 0] }),
        interactive: false,
        keyboard: false,
      }).addTo(grupo);
    }
    L.marker(centro, {
      icon: L.divIcon({ className: '', html: etiquetaHtml('Oficina', null), iconSize: [0, 0] }),
      interactive: false,
      keyboard: false,
    }).addTo(grupo);
    L.circleMarker(centro, { radius: 6, color: '#fff', weight: 2, fillColor: '#9D273C', fillOpacity: 1, interactive: false }).addTo(grupo);
    return () => {
      grupo.remove();
    };
  }, [verRadios]);

  // Recorrido por calle: la traza (con un borde blanco para que se lea sobre el mapa y el satélite) y las
  // paradas numeradas; al aparecer se encuadra el recorrido completo.
  useEffect(() => {
    const map = mapRef.current;
    const validas = rutas.filter((r) => r.geometria.length >= 2);
    if (!map || validas.length === 0) return;
    const grupo = L.layerGroup().addTo(map);
    const todas = L.featureGroup();
    for (const r of validas) {
      const linea = r.geometria.map(([lng, lat]) => L.latLng(lat, lng));
      L.polyline(linea, { color: '#fff', weight: 8, opacity: 0.9, interactive: false }).addTo(grupo);
      todas.addLayer(L.polyline(linea, { color: r.color, weight: 4.5, opacity: 0.95, interactive: false }).addTo(grupo));
      for (const p of r.paradas) {
        L.marker([p.latitud, p.longitud], {
          icon: L.divIcon({
            className: '',
            html: `<div style="transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;background:${r.color};color:#fff;border:2px solid #fff;font:700 11px 'Segoe UI',Arial,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.4)">${p.posicion}</div>`,
            iconSize: [0, 0],
          }),
          title: p.titulo,
          keyboard: false,
        }).addTo(grupo);
      }
    }
    L.circleMarker([OFICINA.latitud, OFICINA.longitud], { radius: 6, color: '#fff', weight: 2, fillColor: '#9D273C', fillOpacity: 1, interactive: false }).addTo(grupo);
    map.fitBounds(todas.getBounds().pad(0.1));
    return () => {
      grupo.remove();
    };
  }, [rutas]);

  // Puntos de las unidades de la zona elegida, coloreados por estado.
  useEffect(() => {
    const grupo = puntosRef.current;
    if (!grupo) return;
    grupo.clearLayers();
    unidadPorMarcador.current.clear();
    // Un poco más grandes al elegir un distrito (el mapa está más acercado).
    const radio = distritoSel ? 8 : 5;
    for (const u of unidades) {
      if (!Number.isFinite(u.latitud) || !Number.isFinite(u.longitud)) continue;
      const color = FLOTA_CATEGORIA_COLOR[u.categoria] ?? '#9ca3af';
      const m = L.circleMarker([u.latitud, u.longitud], { radius: radio, weight: 1, color, fillColor: color, fillOpacity: 0.85 });
      unidadPorMarcador.current.set(m, u);
      grupo.addLayer(m);
    }
  }, [unidades, distritoSel]);

  // Encuadre inicial sobre toda la provincia (una sola vez).
  useEffect(() => {
    const map = mapRef.current;
    const capa = capaRef.current;
    if (!map || !capa || encuadradoRef.current) return;
    map.fitBounds(capa.getBounds().pad(0.03));
    encuadradoRef.current = true;
  }, [valores]);

  return <div ref={containerRef} className="h-[60vh] min-h-[360px] w-full rounded-lg lg:h-[calc(100vh-15rem)] lg:min-h-[420px]" />;
}
