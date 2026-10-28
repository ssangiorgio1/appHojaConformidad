import { describe, expect, it } from 'vitest';
import { evaluarTarea } from './verificarTarea.js';

const unidad = { name: 'AB123CD', parent_id: [21071, 'Instalación'] as [number, string], is_closed: false, state: '01_in_progress' };
const esperado = { nombre: 'AB123CD', parentId: 21071 };

describe('evaluarTarea (antes de escribir en Odoo)', () => {
  it('deja pasar la tarea que se reportó: mismo nombre, mismo padre y abierta', () => {
    expect(evaluarTarea(21072, unidad, esperado)).toEqual({ ok: true });
  });

  it('una tarea que no existe en este Odoo no se toca', () => {
    const r = evaluarTarea(21072, undefined, esperado);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toContain('no existe en este Odoo');
  });

  it('el mismo id con otro nombre es una tarea ajena (otro Odoo o tarea cambiada): no se toca', () => {
    const r = evaluarTarea(21072, { ...unidad, name: 'Mineral del Río S.A.' }, { nombre: 'PRUEBA', parentId: 21071 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toContain('no es la que se reportó');
    expect(!r.ok && r.motivo).toContain('Mineral del Río S.A.');
  });

  it('compara el nombre sin importar mayúsculas ni espacios de más', () => {
    expect(evaluarTarea(1, { ...unidad, name: '  ab123cd ' }, { nombre: 'AB123CD', parentId: 21071 }).ok).toBe(true);
  });

  it('una tarea ya cerrada no se reabre ni se mueve de fecha', () => {
    const hecha = evaluarTarea(21072, { ...unidad, is_closed: true, state: '1_done' }, esperado);
    expect(hecha.ok).toBe(false);
    expect(!hecha.ok && hecha.motivo).toContain('ya está hecha');
    const cancelada = evaluarTarea(21072, { ...unidad, is_closed: true, state: '1_canceled' }, esperado);
    expect(!cancelada.ok && cancelada.motivo).toContain('ya está cancelada');
  });

  it('una tarea en espera (visita fallida) sí se puede reprogramar', () => {
    expect(evaluarTarea(21072, { ...unidad, state: '04_waiting_normal' }, esperado).ok).toBe(true);
  });

  it('una unidad que cuelga de otro padre no es la reportada', () => {
    const r = evaluarTarea(21072, { ...unidad, parent_id: [99999, 'Otro lote'] }, esperado);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toContain('no pertenece a la misma tarea');
  });

  it('una tarea suelta no debe tener padre', () => {
    expect(evaluarTarea(5, { name: 'Visita', parent_id: false, is_closed: false }, { nombre: 'Visita', parentId: null }).ok).toBe(true);
    expect(evaluarTarea(5, { name: 'Visita', parent_id: [7, 'Lote'], is_closed: false }, { nombre: 'Visita', parentId: null }).ok).toBe(false);
  });

  it('sin nombre guardado (incidencia vieja) no se compara el nombre, pero sí que esté abierta', () => {
    expect(evaluarTarea(5, { name: 'Lo que sea', parent_id: false, is_closed: false }, { nombre: '', parentId: null }).ok).toBe(true);
    expect(evaluarTarea(5, { name: 'Lo que sea', parent_id: false, is_closed: true }, { nombre: '', parentId: null }).ok).toBe(false);
  });
});

describe('evaluarTarea: el ticket de la tarea', () => {
  const padre = { helpdesk_ticket_id: [39086, 'Instalación (#39086)'] as [number, string] };

  it('una unidad de un lote cuyo padre es del mismo ticket reportado pasa', () => {
    expect(evaluarTarea(21072, unidad, { ...esperado, ticketId: 39086 }, padre).ok).toBe(true);
  });

  it('si el padre pertenece a OTRO ticket no es la tarea reportada (el caso del ticket 39086)', () => {
    const r = evaluarTarea(21072, unidad, { ...esperado, ticketId: 39091 }, padre);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toContain('pertenece al ticket #39086');
    expect(!r.ok && r.motivo).toContain('#39091');
  });

  it('una tarea suelta compara su propio ticket', () => {
    const suelta = { name: 'Visita', parent_id: false as const, is_closed: false, helpdesk_ticket_id: [500, 'x'] as [number, string] };
    expect(evaluarTarea(5, suelta, { nombre: 'Visita', parentId: null, ticketId: 500 }).ok).toBe(true);
    expect(evaluarTarea(5, suelta, { nombre: 'Visita', parentId: null, ticketId: 501 }).ok).toBe(false);
  });

  it('si la tarea no tiene ticket vinculado no se rechaza por eso (el nombre y el padre ya se comprobaron)', () => {
    expect(evaluarTarea(21072, unidad, { ...esperado, ticketId: 39091 }, { helpdesk_ticket_id: false }).ok).toBe(true);
  });

  it('sin ticket reportado no se compara', () => {
    expect(evaluarTarea(21072, unidad, { ...esperado, ticketId: null }, padre).ok).toBe(true);
  });
});
