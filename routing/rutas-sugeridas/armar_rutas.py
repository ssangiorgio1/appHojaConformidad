# Arma web/src/data/rutasSugeridas.json (accesos, corredores, variantes y rutas nacionales/provinciales de Mendoza) a partir de
# OpenStreetMap. Uso: 1) bash bajar_vias.sh <carpeta de trabajo> (descarga vias_geom.json de Overpass)  2) con el OSRM local
# levantado (routing/README.md): python armar_rutas.py <carpeta de trabajo>/pylib  (necesita shapely: pip install --target <carpeta>/pylib shapely).
# Para cada ruta prueba varias formas de elegir los puntos clave y se queda con la que da un largo por calle parecido al del mapa.
import sys, json, re, math, urllib.request
sys.path.insert(0, sys.argv[1])
from shapely.geometry import LineString, MultiLineString, Point
from shapely.ops import linemerge, unary_union, substring, nearest_points

S = sys.argv[1].replace('/pylib', '')
OFICINA = (-68.857, -32.8838)  # lng, lat
d = json.load(open(S + '/vias_geom.json', encoding='utf-8'))

KX = math.cos(math.radians(OFICINA[1]))


def km(a, b):
    return math.hypot((a[0] - b[0]) * KX, a[1] - b[1]) * 111.195


def largo_km(line):
    c = list(line.coords)
    return sum(km(c[i], c[i + 1]) for i in range(len(c) - 1))


def clave(tags):
    n = (tags.get('name') or '')
    ref = (tags.get('ref') or '').split(';')[0]
    nl = n.lower()
    if 'acceso este' in nl: return ('Acceso Este', 'acceso')
    if 'acceso sur' in nl: return ('Acceso Sur', 'acceso')
    if 'acceso norte' in nl: return ('Acceso Norte', 'acceso')
    if 'acceso oeste' in nl: return ('Acceso Oeste', 'acceso')
    if 'corredor' in nl: return ('Corredor del Oeste', 'corredor')
    if 'variante palmira' in nl: return ('Variante Palmira', 'variante')
    if 'costanera' in nl: return ('Costanera', 'costanera')
    if 'circunvalaci' in nl: return ('Circunvalación', 'circunvalacion')
    if 'panamericana' in nl or ref == 'RP82': return ('Panamericana (RP82)', 'provincial')
    if re.fullmatch(r'RN\d+', ref): return (f'Ruta Nacional {ref[2:]}', 'nacional')
    if re.fullmatch(r'RP\d+', ref): return (f'Ruta Provincial {ref[2:]}', 'provincial')
    return None


GEMELAS = []  # calzadas paralelas descartadas del grupo que se está procesando
grupos = {}
for e in d['elements']:
    k = clave(e['tags'])
    if not k or not e.get('geometry') or len(e['geometry']) < 2: continue
    grupos.setdefault(k, []).append(LineString([(p['lon'], p['lat']) for p in e['geometry']]))

GRAD = 0.0015  # ~150 m


def componentes(lines, urbano=False):
    m = linemerge(unary_union(lines))
    comps = list(m.geoms) if isinstance(m, MultiLineString) else [m]
    # Las rutas urbanas con nombre (accesos, corredor, variante...) se limitan al Gran Mendoza: el mismo nombre se repite
    # en otros departamentos y confundiría el trazo.
    if urbano:
        comps = [c for c in comps if km(OFICINA, nearest_points(Point(OFICINA), c)[1].coords[0]) <= 45]
        if not comps: return []
    comps.sort(key=lambda c: -largo_km(c))
    # descartar la calzada paralela (sentido contrario de una autopista)
    keep = []
    for c in comps:
        if keep:
            zona = unary_union(keep).buffer(GRAD)
            if c.intersection(zona).length / max(c.length, 1e-9) > 0.6:
                GEMELAS.append(c)
                continue
        keep.append(c)
    return keep


def cadena(comps):
    """Une los tramos que quedan a menos de 10 km uno del otro en una sola línea."""
    linea = list(comps[0].coords)
    resto = comps[1:]
    while resto:
        mejor = None
        for c in resto:
            cc = list(c.coords)
            for fin in (0, -1):  # extremo de la cadena
                for ex in (0, -1):  # extremo del tramo
                    dist = km(linea[fin], cc[ex])
                    if mejor is None or dist < mejor[0]: mejor = (dist, c, fin, ex)
        if mejor is None or mejor[0] > 15: break
        dist, c, fin, ex = mejor
        cc = list(c.coords)
        if ex == -1: cc = cc[::-1]  # que el extremo que se une quede primero
        linea = linea + cc if fin == -1 else cc[::-1] + linea
        resto = [x for x in resto if x is not c]
    return LineString(linea)


def rumbo(a, b):
    ang = math.degrees(math.atan2((b[0] - a[0]) * KX, b[1] - a[1])) % 360
    return ['norte', 'noreste', 'este', 'sudeste', 'sur', 'sudoeste', 'oeste', 'noroeste'][int(((ang + 22.5) % 360) // 45)]


def puntos_clave(line, maximo=10):
    tol = 0.002
    s = line
    while True:
        s = line.simplify(tol, preserve_topology=False)
        if len(s.coords) <= maximo: break
        tol *= 1.5
    pts = [(round(x, 5), round(y, 5)) for x, y in s.coords]
    return pts


OSRM = 'http://localhost:5000'


def km_ruta(pts):
    """Largo por las calles de un recorrido que pasa por los puntos, o None si no hay camino."""
    coords = ';'.join(f'{x:.6f},{y:.6f}' for x, y in pts)
    try:
        with urllib.request.urlopen(f'{OSRM}/route/v1/driving/{coords}?overview=false', timeout=60) as r:
            j = json.load(r)
        return j['routes'][0]['distance'] / 1000 if j.get('code') == 'Ok' else None
    except Exception:
        return None


def alinear(linea_gemela, br):
    """La calzada gemela orientada igual que el brazo (que arranque del lado de la oficina)."""
    c = list(linea_gemela.coords)
    if km(br.coords[0], c[0]) > km(br.coords[0], c[-1]): c = c[::-1]
    return LineString(c)


def mejor_variante(br, gemelas):
    """Prueba varias formas de elegir los puntos clave (la calzada de un sentido o la del otro, con más o menos puntos
    intermedios) y se queda con la que da un largo por calle más parecido al del mapa. Las autopistas de dos calzadas
    obligan a dar vueltas si los puntos caen en la calzada del sentido contrario."""
    esperado = largo_km(br)
    candidatos = []
    bases = [br]
    zona = br.buffer(GRAD)
    for g in gemelas:
        sub = g.intersection(zona.buffer(GRAD))
        if g.intersection(zona).length > 0.3 * g.length:
            bases.append(alinear(g, br))
    for base in bases:
        full = puntos_clave(base)
        medio = full[:: max(1, len(full) // 3)]
        candidatos += [full, [full[0], full[len(full) // 2], full[-1]], [full[0], full[-1]], medio if medio[-1] == full[-1] else medio + [full[-1]]]
    mejor = None
    for pts in candidatos:
        if len(pts) < 2: continue
        km_r = km_ruta(pts)
        if km_r is None: continue
        ratio = km_r / max(esperado, 1)
        error = abs(ratio - 1)
        if mejor is None or error < mejor[0] - 0.02 or (abs(error - mejor[0]) <= 0.02 and len(pts) > len(mejor[1])):
            mejor = (error, pts, ratio)
    return mejor


salida = []
for (nombre, tipo), lines in sorted(grupos.items()):
    GEMELAS.clear()
    comps = componentes(lines, urbano=tipo in ('acceso', 'corredor', 'costanera', 'variante', 'circunvalacion'))
    if not comps: continue
    linea = cadena(comps)
    if largo_km(linea) < 5: continue
    o = Point(OFICINA)
    # ¿pasa cerca de la oficina? entonces se parte en dos brazos que salen de ella
    dist_of = km(OFICINA, nearest_points(o, linea)[1].coords[0])
    brazos = []
    if dist_of < 6:
        pos = linea.project(o)
        a = substring(linea, 0, pos) if pos > 0 else None
        b = substring(linea, pos, linea.length)
        for br, invertir in ((a, True), (b, False)):
            if br is not None and br.geom_type == 'LineString' and largo_km(br) >= 5:
                c = list(br.coords)[::-1] if invertir else list(br.coords)
                brazos.append(LineString(c))
    else:
        c = list(linea.coords)
        if km(OFICINA, c[0]) > km(OFICINA, c[-1]): c = c[::-1]
        brazos.append(LineString(c))
    for br in brazos:
        c = list(br.coords)
        sufijo = f' (hacia el {rumbo(c[0], c[-1])})' if len(brazos) > 1 else ''
        mv = mejor_variante(br, list(GEMELAS))
        puntos = mv[1] if mv else puntos_clave(br)
        ratio = mv[2] if mv else None
        salida.append({
            'id': re.sub(r'[^a-z0-9]+', '-', (nombre + sufijo).lower()).strip('-'),
            'nombre': nombre + sufijo,
            'tipo': tipo,
            'largoKm': round(largo_km(br)),
            'distOficinaKm': round(km(OFICINA, c[0]), 1),
            'puntos': puntos,
            # true si, aun con el mejor intento, el largo por calle difiere mucho del largo en el mapa: hay que mirarla
            'revisar': ratio is None or not (0.85 <= ratio <= 1.25),
            'ratio': round(ratio, 2) if ratio else None,
        })

orden_tipo = {'acceso': 0, 'corredor': 1, 'costanera': 2, 'variante': 3, 'circunvalacion': 4, 'nacional': 5, 'provincial': 6}
salida.sort(key=lambda r: (orden_tipo[r['tipo']], r['nombre']))
json.dump(salida, open('C:/h/web/src/data/rutasSugeridas.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
for r in salida:
    print(f"{r['tipo']:<14} {r['nombre']:<48} {r['largoKm']:>4} km  {len(r['puntos'])} pts  x{r['ratio']}  {'REVISAR' if r['revisar'] else 'ok'}")
print(len(salida), 'rutas sugeridas')
