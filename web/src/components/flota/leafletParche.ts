import L from 'leaflet';

// Leaflet 1.9.4 puede ejecutar un redibujado del canvas pendiente DESPUÉS de que el mapa se desmontó
// (al cambiar de vista de mapa): el renderer ya borró su contexto y falla en `_clear`/`_redraw` con
// "Cannot read properties of undefined". Se ignora ese redibujado: no hay nada que dibujar.
// Idempotente: se puede importar desde varios mapas.
type CanvasInterno = {
  _ctx?: CanvasRenderingContext2D;
  _redrawRequest?: number | null;
  _redraw: () => void;
  _updatePaths: () => void;
  __parcheado?: boolean;
};

const proto = L.Canvas.prototype as unknown as CanvasInterno;
if (!proto.__parcheado) {
  const redraw = proto._redraw;
  const updatePaths = proto._updatePaths;
  proto._redraw = function (this: CanvasInterno) {
    if (!this._ctx) {
      this._redrawRequest = null;
      return;
    }
    redraw.call(this);
  };
  proto._updatePaths = function (this: CanvasInterno) {
    if (!this._ctx) return;
    updatePaths.call(this);
  };
  proto.__parcheado = true;
}
