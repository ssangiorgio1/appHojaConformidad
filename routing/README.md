# Rutas por calle (OSRM) — prueba local

Servicio de rutas para calcular distancia y tiempo por calle en la zona de Cuyo. Es solo para pruebas locales: **no está conectado a la API de producción**.

## Primera vez
1. Docker abierto.
2. `bash routing/preparar.sh` (descarga el mapa de Argentina, lo recorta a Cuyo y prepara los datos en `C:\osrm-data`; tarda unos minutos).
3. `docker compose -f routing/docker-compose.yml up -d`

## Probar
```
curl "http://localhost:5000/route/v1/driving/-68.857,-32.8838;-68.33,-34.617?overview=false"
```
Oficina a San Rafael: unos 236 km y 176 min.

## Operación
- Parar: `docker compose -f routing/docker-compose.yml down`
- Actualizar el mapa: borrar `C:\osrm-data\argentina-latest.osm.pbf` y volver a correr `preparar.sh`.
- Los datos (`C:\osrm-data`, ~700 MB con el mapa de Argentina) quedan fuera del repositorio.

## Pasarlo a un servidor (Ubuntu)
Mismos pasos con `apt install docker.io osmium-tool` o las mismas imágenes; publicar el puerto 5000 solo en la red interna (OSRM no tiene autenticación) y apuntar la API a `http://<ip-del-servidor>:5000`.

## Rutas sugeridas para el panel
`routing/rutas-sugeridas/` arma `web/src/data/rutasSugeridas.json` (accesos, corredores, variantes y rutas nacionales y provinciales de OpenStreetMap) para ofrecerlas en la pestaña "Rutas y territorios". Ver el encabezado de `armar_rutas.py`.
