#!/usr/bin/env bash
# Prepara los datos de OSRM para la zona de Cuyo a partir del mapa de Argentina (OpenStreetMap/Geofabrik).
# Se corre una sola vez (o para actualizar el mapa). Necesita Docker. Uso: bash routing/preparar.sh
set -euo pipefail

DATA="${OSRM_DATA:-C:/osrm-data}"
PBF="$DATA/argentina-latest.osm.pbf"
# Recuadro (oeste,sur,este,norte): Mendoza con margen para viajes a San Juan, San Luis y Neuquén.
BBOX="-70.9,-37.9,-66.0,-31.5"

if [ ! -f "$PBF" ]; then
  echo "Descargando el mapa de Argentina…"
  curl -L -o "$PBF" https://download.geofabrik.de/south-america/argentina-latest.osm.pbf
fi

echo "Recortando a la zona de Cuyo…"
MSYS_NO_PATHCONV=1 docker run --rm -v "$DATA:/data" iboates/osmium:latest \
  extract -b "$BBOX" --strategy=smart --overwrite /data/argentina-latest.osm.pbf -o /data/mendoza.osm.pbf

OSRM=ghcr.io/project-osrm/osrm-backend
echo "osrm-extract (perfil de auto)…"
MSYS_NO_PATHCONV=1 docker run --rm -v "$DATA:/data" $OSRM osrm-extract -p /opt/car.lua /data/mendoza.osm.pbf
echo "osrm-partition…"
MSYS_NO_PATHCONV=1 docker run --rm -v "$DATA:/data" $OSRM osrm-partition /data/mendoza.osrm
echo "osrm-customize…"
MSYS_NO_PATHCONV=1 docker run --rm -v "$DATA:/data" $OSRM osrm-customize /data/mendoza.osrm

echo "Listo. Levantá el servicio con: docker compose -f routing/docker-compose.yml up -d"
