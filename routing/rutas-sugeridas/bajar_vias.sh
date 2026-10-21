#!/usr/bin/env bash
S="$1"
Q='[out:json][timeout:120][bbox:-34.9,-69.6,-32.4,-67.6];(way["highway"~"^(motorway|trunk|primary|secondary)$"]["name"~"Costanera|Acceso Norte|Acceso Oeste|Circunvalaci|Variante|Corredor|Acceso Este|Acceso Sur"];way["highway"~"^(motorway|trunk|primary)$"]["ref"~"^(RN7|RN40|RN143|RN146|RN142|RN144|RP50|RP60|RP153|RP34|RP150|RP171|RP82|RP22)$"];);out geom;'
for i in 1 2 3 4 5 6; do
  code=$(curl -s -m 150 -H "User-Agent: wara-panel/1.0 (jsangiorgio@waragps.com)" -H "Accept: */*" -o "$S/vias_geom.json" -w "%{http_code}" --data-urlencode "data=$Q" https://overpass-api.de/api/interpreter)
  echo "intento $i: HTTP $code"
  if [ "$code" = "200" ]; then echo OK; exit 0; fi
  sleep 25
done
echo FALLO; exit 1
