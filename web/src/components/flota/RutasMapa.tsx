'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './leafletParche';
import { useEffect, useRef } from 'react';
import type { RutaAcceso } from '@/lib/rutasAcceso';
import { OFICINA } from '@/lib/oficina';
import { sateliteEsri } from './sateliteEsri';

// Mapa de las rutas de acceso rápido: se ven las guardadas (con sus puntos clave) y, al marcar, cada clic agrega un
// punto; el trazo por las calles entre los puntos llega calculado (se puede mover el mapa arrastrando).
export default function RutasMapa({
  rutas,
  dibujando,
  nuevo,
  trazoNuevo,
  colorNuevo,
  onPunto,
  resaltada = null,
  previa = [],
}: {
  rutas: RutaAcceso[];
  dibujando: boolean;
  /** Puntos clave que se van marcando, como [longitud, latitud]. */
  nuevo: Array<[number, number]>;
  /** Trazo por las calles que pasa por esos puntos (vista previa que calcula la API); vacío si todavía no hay. */
  trazoNuevo: Array<[number, number]>;
  colorNuevo: string;
  onPunto: (lng: number, lat: number) => void;
  /** Id de la ruta que se quiere destacar (la que está pasando el mouse en la lista). */
  resaltada?: string | null;
  /** Trazo de una ruta sugerida que se está mirando antes de agregarla (línea negra punteada). */
  previa?: Array<[number, number]>;
}) {
  const contRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const guardadasRef = useRef<L.LayerGroup | null>(null);
  const nuevoRef = useRef<L.LayerGroup | null>(null);
  const previaRef = useRef<L.LayerGroup | null>(null);
  const puntoCbRef = useRef(onPunto);
  const dibujandoRef = useRef(dibujando);
  const encuadradoRef = useRef(false);
  useEffect(() => {
    puntoCbRef.current = onPunto;
    dibujandoRef.current = dibujando;
  });

  useEffect(() => {
    if (!contRef.current || mapRef.current) return;
    const map = L.map(contRef.current, { maxZoom: 21 }).setView([OFICINA.latitud, OFICINA.longitud], 10);
    const calles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxNativeZoom: 19,
      maxZoom: 21,
    }).addTo(map);
    const satelite = L.layerGroup([sateliteEsri()]);
    L.control.layers({ Calles: calles, Satélite: satelite }, undefined, { position: 'topright' }).addTo(map);
    L.circleMarker([OFICINA.latitud, OFICINA.longitud], { radius: 6, color: '#fff', weight: 2, fillColor: '#9D273C', fillOpacity: 1, interactive: false }).addTo(map);
    guardadasRef.current = L.layerGroup().addTo(map);
    nuevoRef.current = L.layerGroup().addTo(map);
    previaRef.current = L.layerGroup().addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (dibujandoRef.current) puntoCbRef.current(e.latlng.lng, e.latlng.lat);
    });
    mapRef.current = map;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(contRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      guardadasRef.current = null;
      nuevoRef.current = null;
      previaRef.current = null;
    };
  }, []);

  // Cursor de mira mientras se dibuja.
  useEffect(() => {
    const el = mapRef.current?.getContainer();
    if (el) el.style.cursor = dibujando ? 'crosshair' : '';
  }, [dibujando]);

  // Rutas guardadas: el trazo con un borde blanco y el nombre en el medio.
  useEffect(() => {
    const grupo = guardadasRef.current;
    const map = mapRef.current;
    if (!grupo || !map) return;
    grupo.clearLayers();
    const todas = L.featureGroup();
    for (const r of rutas) {
      if (r.trazo.length < 2) continue;
      const linea = r.trazo.map(([lng, lat]) => L.latLng(lat, lng));
      const destacada = r._id === resaltada;
      L.polyline(linea, { color: '#fff', weight: destacada ? 11 : 8, opacity: 0.9, interactive: false }).addTo(grupo);
      const traza = L.polyline(linea, { color: r.color, weight: destacada ? 7 : 4.5, opacity: r.activa ? 0.95 : 0.4, dashArray: r.activa ? undefined : '8 6' }).addTo(grupo);
      traza.bindTooltip(`${r.nombre} · ancho ${r.anchoKm} km`, { sticky: true });
      todas.addLayer(traza);
      // Los puntos clave marcados.
      for (const [lng, lat] of r.puntos ?? []) L.circleMarker([lat, lng], { radius: 4, color: '#fff', weight: 2, fillColor: r.color, fillOpacity: 1, interactive: false }).addTo(grupo);
    }
    if (!encuadradoRef.current && todas.getLayers().length > 0) {
      map.fitBounds(todas.getBounds().pad(0.1));
      encuadradoRef.current = true;
    }
  }, [rutas, resaltada]);

  // Ruta sugerida en vista previa: se encuadra para verla completa.
  useEffect(() => {
    const grupo = previaRef.current;
    const map = mapRef.current;
    if (!grupo || !map) return;
    grupo.clearLayers();
    if (previa.length < 2) return;
    const linea = previa.map(([lng, lat]) => L.latLng(lat, lng));
    L.polyline(linea, { color: '#fff', weight: 9, opacity: 0.9, interactive: false }).addTo(grupo);
    const traza = L.polyline(linea, { color: '#111827', weight: 4, dashArray: '10 7', interactive: false }).addTo(grupo);
    map.fitBounds(traza.getBounds().pad(0.15));
  }, [previa]);

  // Trazo en construcción.
  useEffect(() => {
    const grupo = nuevoRef.current;
    if (!grupo) return;
    grupo.clearLayers();
    if (nuevo.length === 0) return;
    const puntos = nuevo.map(([lng, lat]) => L.latLng(lat, lng));
    // Trazo por las calles (si ya llegó) o, mientras tanto, la línea recta entre los puntos.
    const trazo = trazoNuevo.length > 1 ? trazoNuevo.map(([lng, lat]) => L.latLng(lat, lng)) : puntos;
    if (trazo.length > 1) {
      L.polyline(trazo, { color: '#fff', weight: 8, opacity: 0.9, interactive: false }).addTo(grupo);
      L.polyline(trazo, { color: colorNuevo, weight: 4.5, dashArray: trazoNuevo.length > 1 ? undefined : '2 8', interactive: false }).addTo(grupo);
    }
    puntos.forEach((p, i) =>
      L.marker(p, {
        icon: L.divIcon({
          className: '',
          html: `<div style="transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;background:${colorNuevo};color:#fff;border:2px solid #fff;font:700 11px 'Segoe UI',Arial,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.4)">${i + 1}</div>`,
          iconSize: [0, 0],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(grupo),
    );
  }, [nuevo, trazoNuevo, colorNuevo]);

  return <div ref={contRef} className="h-[60vh] min-h-[380px] w-full rounded-lg lg:h-[calc(100vh-17rem)] lg:min-h-[420px]" />;
}
