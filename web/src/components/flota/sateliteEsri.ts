import L from 'leaflet';

// Esri World Imagery no tiene imágenes a todos los zooms: en zonas rurales de Mendoza llega hasta el
// 17 y en las ciudades hasta el 19; más allá devuelve una imagen de ~2 KB que dice "Map data not
// yet available". Esta capa detecta ese caso y, en vez de mostrarlo, estira el mosaico de un zoom
// menor que sí exista (queda más borroso, pero se puede seguir acercando).
const URL_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';
// Un mosaico real pesa 8 KB o más; el aviso de "sin datos", unos 2 KB.
const MIN_BYTES_REAL = 4000;
const MAX_NIVELES_ATRAS = 6;

const cache = new Map<string, Promise<ImageBitmap | null>>();

function cargar(z: number, x: number, y: number): Promise<ImageBitmap | null> {
  const clave = `${z}/${x}/${y}`;
  let p = cache.get(clave);
  if (!p) {
    p = fetch(`${URL_IMAGERY}/${z}/${y}/${x}`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b && b.size >= MIN_BYTES_REAL ? createImageBitmap(b) : null))
      .catch(() => null);
    cache.set(clave, p);
    if (cache.size > 600) cache.delete(cache.keys().next().value as string);
  }
  return p;
}

class SateliteEsri extends L.GridLayer {
  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tam = this.getTileSize();
    const canvas = document.createElement('canvas');
    canvas.width = tam.x;
    canvas.height = tam.y;
    const ctx = canvas.getContext('2d');
    const { x, y, z } = coords;
    (async () => {
      if (!ctx) return;
      for (let k = 0; k <= Math.min(MAX_NIVELES_ATRAS, z); k++) {
        const bmp = await cargar(z - k, x >> k, y >> k);
        if (!bmp) continue;
        const lado = tam.x >> k; // k = 0: el mosaico entero; k > 0: la porción que corresponde dentro del mosaico padre
        const sx = (x - ((x >> k) << k)) * lado;
        const sy = (y - ((y >> k) << k)) * lado;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bmp, sx, sy, lado, lado, 0, 0, tam.x, tam.y);
        return;
      }
    })().then(
      () => done(undefined, canvas),
      (err) => done(err as Error, canvas),
    );
    return canvas;
  }
}

export function sateliteEsri(options?: L.GridLayerOptions): L.GridLayer {
  return new SateliteEsri({ attribution: 'Tiles &copy; Esri', maxZoom: 21, ...options });
}
