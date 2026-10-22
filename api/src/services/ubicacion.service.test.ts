import { describe, expect, it, vi } from 'vitest';
import {
  esLinkCorto,
  expandirLinkCorto,
  formatearDireccion,
  hostPermitido,
  parsearLinkDeMaps,
  parsearTextoUbicacion,
  pareceCoordenadas,
  resolverUbicacion,
  tieneDatos,
} from './ubicacion.service.js';

const LARGO_SIN_LUGAR =
  "https://www.google.com/maps/place/32%C2%B052'23.3%22S+68%C2%B051'02.8%22W/@-32.8731235,-68.8533499,17z/data=!3m1!4b1!4m4!3m3!8m2!3d-32.873128!4d-68.850775?entry=tts";

describe('parsearLinkDeMaps', () => {
  it('usa el pin exacto (!3d!4d) y no el centro del mapa', () => {
    const d = parsearLinkDeMaps(LARGO_SIN_LUGAR);
    expect(d.lat).toBeCloseTo(-32.873128, 6);
    expect(d.lng).toBeCloseTo(-68.850775, 6);
  });
  it('cuando Google puso las coordenadas como nombre, no lo toma como lugar', () => {
    expect(parsearLinkDeMaps(LARGO_SIN_LUGAR).nombre).toBeNull();
  });
  it('toma el nombre del lugar de la ruta /place/', () => {
    const d = parsearLinkDeMaps('https://www.google.com/maps/place/Estaci%C3%B3n+de+Servicio+YPF/@-38.95,-68.06,17z/data=!3d-38.951!4d-68.059');
    expect(d.nombre).toBe('Estación de Servicio YPF');
    expect(d.lat).toBeCloseTo(-38.951, 3);
  });
  it('lee el centro (@lat,lng) si no hay pin', () => {
    const d = parsearLinkDeMaps('https://www.google.com/maps/place/Salta+2529/@-32.87,-68.83,18z');
    expect(d.nombre).toBe('Salta 2529');
    expect(d.lat).toBeCloseTo(-32.87, 2);
    expect(d.lng).toBeCloseTo(-68.83, 2);
  });
  it('lee ?q=lat,lng', () => {
    const d = parsearLinkDeMaps('https://maps.google.com/?q=-38.9516,-68.0591');
    expect(d.lat).toBeCloseTo(-38.9516, 4);
    expect(d.nombre).toBeNull();
  });
  it('?q=texto da el nombre sin coordenadas', () => {
    const d = parsearLinkDeMaps('https://www.google.com/maps?q=Parque+Industrial+Neuqu%C3%A9n');
    expect(d.nombre).toBe('Parque Industrial Neuquén');
    expect(d.lat).toBeNull();
  });
  it('distingue el pin exacto del centro del mapa', () => {
    expect(parsearLinkDeMaps(LARGO_SIN_LUGAR).exacta).toBe(true);
    expect(parsearLinkDeMaps('https://www.google.com/maps/place/Salta+2529/@-32.87,-68.83,18z').exacta).toBe(false);
    expect(parsearLinkDeMaps('https://maps.google.com/?q=-38.9516,-68.0591').exacta).toBe(true);
  });
  it('ignora coordenadas imposibles', () => {
    expect(parsearLinkDeMaps('https://www.google.com/maps/@999.1,500.2,17z').lat).toBeNull();
  });
});

describe('parsearTextoUbicacion', () => {
  it('un par "lat, lng" suelto', () => {
    expect(parsearTextoUbicacion('-32.8731, -68.8507')).toMatchObject({ lat: -32.8731, lng: -68.8507 });
  });
  it('una dirección escrita a mano no tiene coordenadas', () => {
    expect(parsearTextoUbicacion('Salta 2529, Mendoza')).toEqual({ lat: null, lng: null, nombre: 'Salta 2529, Mendoza', exacta: false });
  });
});

describe('pareceCoordenadas', () => {
  it('distingue coordenadas de nombres', () => {
    expect(pareceCoordenadas("32°52'23.3\"S 68°51'02.8\"W")).toBe(true);
    expect(pareceCoordenadas('-32.87, -68.85')).toBe(true);
    expect(pareceCoordenadas('Salta 2529')).toBe(false);
    expect(pareceCoordenadas('Av. Olascoaga 1234')).toBe(false);
  });
});

describe('seguridad de los links cortos', () => {
  it('solo reconoce hosts de Google', () => {
    expect(hostPermitido('https://maps.app.goo.gl/abc')).toBe(true);
    expect(hostPermitido('https://www.google.com/maps/place/x')).toBe(true);
    expect(hostPermitido('https://www.google.com.ar/maps/place/x')).toBe(true);
    expect(hostPermitido('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(hostPermitido('https://evil.example.com/maps')).toBe(false);
    expect(hostPermitido('https://google.com.evil.com/maps')).toBe(false);
    expect(hostPermitido('javascript:alert(1)')).toBe(false);
  });
  it('detecta el link corto', () => {
    expect(esLinkCorto('https://maps.app.goo.gl/5FHdVFPvAPvudavc8')).toBe(true);
    expect(esLinkCorto('https://www.google.com/maps/place/x')).toBe(false);
  });
  it('expande el link corto siguiendo la redirección', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ status: 302, headers: { get: () => LARGO_SIN_LUGAR } });
    expect(await expandirLinkCorto('https://maps.app.goo.gl/abc', fetchFn)).toBe(LARGO_SIN_LUGAR);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it('no sigue una redirección que sale de Google', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ status: 302, headers: { get: () => 'http://169.254.169.254/latest/meta-data' } });
    expect(await expandirLinkCorto('https://maps.app.goo.gl/abc', fetchFn)).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it('un link que no es de Google ni se intenta', async () => {
    const fetchFn = vi.fn();
    expect(await expandirLinkCorto('https://evil.example.com/x', fetchFn)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('formatearDireccion', () => {
  it('arma calle y número, barrio, ciudad y provincia', () => {
    const d = formatearDireccion({
      house_number: '2445',
      road: 'Cayetano Alberto Silva',
      neighbourhood: 'Barrio Ferroviario',
      city: 'Ciudad de Mendoza',
      state: 'Mendoza',
      postcode: '5500',
    });
    expect(d.calle).toBe('Cayetano Alberto Silva 2445');
    expect(d.direccion).toBe('Cayetano Alberto Silva 2445, Barrio Ferroviario, Ciudad de Mendoza, Mendoza');
    expect(d.ciudad).toBe('Ciudad de Mendoza');
    expect(d.provincia).toBe('Mendoza');
  });
  it('sin número usa solo la calle y no repite partes iguales', () => {
    const d = formatearDireccion({ road: 'Ruta 22', suburb: 'Neuquén', city: 'Neuquén', state: 'Neuquén' });
    expect(d.direccion).toBe('Ruta 22, Neuquén');
  });
  it('sin datos no inventa nada', () => {
    expect(formatearDireccion(null)).toEqual({ calle: null, ciudad: null, provincia: null, direccion: null });
  });
});

describe('resolverUbicacion', () => {
  const dir = {
    calle: 'Cayetano Alberto Silva 2445',
    ciudad: 'Ciudad de Mendoza',
    provincia: 'Mendoza',
    direccion: 'Cayetano Alberto Silva 2445, Barrio Ferroviario, Ciudad de Mendoza, Mendoza',
  };
  const sinDireccion = { calle: null, ciudad: null, provincia: null, direccion: null };

  it('link corto: lo expande, toma las coordenadas y busca la dirección', async () => {
    const geocodificar = vi.fn().mockResolvedValue(dir);
    const r = await resolverUbicacion('https://maps.app.goo.gl/abc', { expandir: async () => LARGO_SIN_LUGAR, geocodificar });
    expect(geocodificar).toHaveBeenCalledWith(expect.closeTo(-32.873128, 5), expect.closeTo(-68.850775, 5));
    expect(r.direccion).toBe(dir.direccion);
    expect(r.calle).toBe('Cayetano Alberto Silva 2445');
    expect(r.url).toBe('https://maps.app.goo.gl/abc');
    expect(tieneDatos(r)).toBe(true);
  });
  it('si no se puede expandir deja solo el link (sin inventar)', async () => {
    const r = await resolverUbicacion('https://maps.app.goo.gl/abc', { expandir: async () => null, geocodificar: vi.fn() });
    expect(r.direccion).toBeNull();
    expect(r.url).toBe('https://maps.app.goo.gl/abc');
    expect(tieneDatos(r)).toBe(false);
  });
  it('si falla la dirección pero el link traía el lugar, muestra el lugar', async () => {
    const r = await resolverUbicacion('https://www.google.com/maps/place/Estaci%C3%B3n+YPF/@-38.95,-68.06,17z/data=!3d-38.951!4d-68.059', {
      geocodificar: async () => sinDireccion,
    });
    expect(r.direccion).toBe('Estación YPF');
    expect(r.nombre).toBe('Estación YPF');
  });
  it('si el link nombra la dirección pero solo trae el centro del mapa, manda el nombre y de las coordenadas toma la localidad', async () => {
    const r = await resolverUbicacion('https://www.google.com/maps/place/Salta+2529/@-32.87,-68.83,18z', {
      geocodificar: async () => ({ calle: 'Fray Mamerto Esquiú 327', ciudad: 'Ciudad de Mendoza', provincia: 'Mendoza', direccion: 'Fray Mamerto Esquiú 327, Ciudad de Mendoza, Mendoza' }),
    });
    expect(r.calle).toBe('Salta 2529');
    expect(r.direccion).toBe('Salta 2529, Ciudad de Mendoza, Mendoza');
    expect(r.direccion).not.toContain('Esquiú');
  });
  it('si el link trae el pin exacto, la dirección sale de las coordenadas', async () => {
    const r = await resolverUbicacion('https://www.google.com/maps/place/Estaci%C3%B3n+YPF/@-38.95,-68.06,17z/data=!3d-38.951!4d-68.059', {
      geocodificar: async () => ({ calle: 'Av. Olascoaga 1234', ciudad: 'Neuquén', provincia: 'Neuquén', direccion: 'Av. Olascoaga 1234, Neuquén' }),
    });
    expect(r.nombre).toBe('Estación YPF');
    expect(r.direccion).toBe('Av. Olascoaga 1234, Neuquén');
  });
  it('una dirección escrita a mano se muestra tal cual, sin consultar nada', async () => {
    const geocodificar = vi.fn();
    const r = await resolverUbicacion('Salta 2529, Mendoza', { geocodificar });
    expect(r.direccion).toBe('Salta 2529, Mendoza');
    expect(geocodificar).not.toHaveBeenCalled();
  });
  it('nunca lanza error aunque algo falle por dentro', async () => {
    const r = await resolverUbicacion('https://maps.app.goo.gl/abc', {
      expandir: async () => {
        throw new Error('sin red');
      },
      geocodificar: vi.fn(),
    });
    expect(r.direccion).toBeNull();
  });
});
