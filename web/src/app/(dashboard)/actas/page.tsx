'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { MultiSelectBuscable } from '@/components/ui/MultiSelectBuscable';
import { Pagination } from '@/components/ui/Pagination';
import { IconChevronDown, IconDocument, IconSearch, IconX } from '@/components/ui/Icons';
import { getRetiroEquipoPdf, listRetirosEquipo, listUsuarios } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { useAuth } from '@/auth/AuthContext';
import { formatFechaHora, formatIsoDateTime } from '@/lib/format';
import type { EstadoEquipoRetiro, ModalidadRetiro, RetiroEquipoDoc } from '@/lib/types';

const PAGE_SIZE = 20;

// 'entrega' = el cliente le da el equipo en mano al técnico (es un RETIRO para la empresa); 'deja_para_retirar' = el técnico lo deja.
const MODALIDAD_LABEL: Record<ModalidadRetiro, string> = {
  entrega: 'Retiro · lo entregó el cliente',
  deja_para_retirar: 'Entrega · lo dejó el técnico',
};
const MODALIDAD_TONE: Record<ModalidadRetiro, BadgeTone> = { entrega: 'ok', deja_para_retirar: 'neutral' };

const ESTADO_EQUIPO_LABEL: Record<EstadoEquipoRetiro, string> = { completo: 'Completo', incompleto: 'Incompleto', danado: 'Dañado' };
const ESTADO_EQUIPO_TONE: Record<EstadoEquipoRetiro, BadgeTone> = { completo: 'ok', incompleto: 'warn', danado: 'bad' };

function nombreTecnico(a: RetiroEquipoDoc): string {
  const t = a.tecnicoId;
  if (!t) return '—';
  if (typeof t === 'string') return t.slice(-6);
  return t.nombre || t.email || '—';
}

// N° de equipo del acta, con un "+N" si se entregaron más (el primero va en `equipo`, el resto en `equiposExtra`).
function equipoResumen(a: RetiroEquipoDoc): string {
  const principal = a.equipo?.numero || a.equipo?.imei || '';
  const extras = (a.equiposExtra ?? []).length;
  if (!principal && !extras) return '—';
  return extras ? `${principal || 'sin N°'} +${extras}` : principal;
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted">{etiqueta}</div>
      <div className="text-[12.5px] font-semibold">{children}</div>
    </div>
  );
}

// Estado del envío del PDF al ticket de Odoo, para que coordinación vea si el acta llegó o por qué no.
function EstadoPdfTicket({ a }: { a: RetiroEquipoDoc }) {
  if (!a.ticketOdooId) return <span className="text-muted">Sin ticket vinculado: el acta no se adjuntó a Odoo</span>;
  if (a.pdfAt) return <span>Adjunto al ticket #{a.ticketOdooId} · {formatIsoDateTime(a.pdfAt)}</span>;
  if (a.pdfError) return <span className="text-bad">No se pudo adjuntar al ticket #{a.ticketOdooId}: {a.pdfError}</span>;
  return <span className="text-muted">Pendiente de adjuntar al ticket #{a.ticketOdooId}</span>;
}

function DetalleActa({ a }: { a: RetiroEquipoDoc }) {
  const recibidos = (a.adicionales ?? []).filter((x) => x.recibido).map((x) => x.nombre);
  const faltantes = (a.adicionales ?? []).filter((x) => !x.recibido).map((x) => x.nombre);
  const extras = a.equiposExtra ?? [];
  const entrega = a.entrega ?? {};
  const fotos = a.fotos ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <Dato etiqueta={a.modalidad === 'entrega' ? 'Quién entrega' : 'Queda con'}>{entrega.nombre || '—'}</Dato>
        <Dato etiqueta="Teléfono">{entrega.telefono || '—'}</Dato>
        {a.modalidad === 'deja_para_retirar' && <Dato etiqueta="Dónde queda">{entrega.lugar || '—'}</Dato>}
        <Dato etiqueta="Equipo">
          N° {a.equipo?.numero || '—'}
          {a.equipo?.imei ? <span className="text-muted"> · IMEI {a.equipo.imei}</span> : null}
        </Dato>
        {extras.length > 0 && (
          <Dato etiqueta={`Otros equipos (${extras.length})`}>
            <ul>
              {extras.map((e, i) => (
                <li key={i}>
                  N° {e.numero || '—'}
                  {e.imei ? <span className="text-muted"> · IMEI {e.imei}</span> : null}
                </li>
              ))}
            </ul>
          </Dato>
        )}
        {(recibidos.length > 0 || faltantes.length > 0) && (
          <Dato etiqueta="Adicionales">
            {recibidos.length > 0 && <div>Recibidos: {recibidos.join(', ')}</div>}
            {faltantes.length > 0 && <div className="text-bad">Faltan: {faltantes.join(', ')}</div>}
          </Dato>
        )}
        {a.observaciones && <Dato etiqueta="Observaciones">{a.observaciones}</Dato>}
        {a.reinstalaEnOtraUnidad && <Dato etiqueta="Destino del equipo">Se instala en otra unidad del cliente (cambio de unidad)</Dato>}
        <Dato etiqueta="Tarea de Odoo">#{a.tareaOdooId}{a.subtareaOdooId ? <span className="text-muted"> · unidad #{a.subtareaOdooId}</span> : null}</Dato>
        <Dato etiqueta="PDF en el ticket">
          <EstadoPdfTicket a={a} />
        </Dato>
        <Dato etiqueta="Firma">
          {a.firma?.url ? (
            <div className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- firma en el bucket público, tamaño chico */}
              <img src={a.firma.url} alt="Firma" className="h-14 w-32 rounded border border-line bg-white object-contain" />
              {a.firma.nombreFirmante && <span className="text-muted">{a.firma.nombreFirmante}</span>}
            </div>
          ) : (
            <span className="text-muted">Sin firma{a.firma?.motivo ? `: ${a.firma.motivo}` : ''}</span>
          )}
        </Dato>
      </div>
      {fotos.length > 0 && (
        <div>
          <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Fotos ({fotos.length})</div>
          <div className="flex flex-wrap gap-2">
            {fotos.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de una foto del bucket público */}
                <img src={f.url} alt={`Foto ${i + 1}`} className="h-20 w-28 rounded border border-line object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActasPage() {
  const { getIdToken } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modalidad, setModalidad] = useState<ModalidadRetiro | ''>('');
  const [tecnicoIds, setTecnicoIds] = useState<string[]>([]);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [page, setPage] = useState(1);
  const [showFiltros, setShowFiltros] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [pdfEnCurso, setPdfEnCurso] = useState<string | null>(null);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);

  // Espera una pausa al tipear antes de pedir al API (no una consulta por tecla).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: usuariosData } = useApiData((idToken) => listUsuarios(idToken), []);
  const tecnicoOpciones = useMemo(
    () =>
      (usuariosData ?? [])
        .filter((u) => u.role === 'tecnico')
        .map((u) => ({ value: u._id, label: u.nombre || u.email }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })),
    [usuariosData],
  );
  const tecnicoNombrePorId = useMemo(() => new Map(tecnicoOpciones.map((o) => [o.value, o.label])), [tecnicoOpciones]);

  const tecnicoIdsParam = tecnicoIds.join(',');
  const { data, loading, error } = useApiData(
    (idToken) =>
      listRetirosEquipo(idToken, {
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        modalidad: modalidad || undefined,
        tecnicoId: tecnicoIdsParam || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
      }),
    [page, debouncedSearch, modalidad, tecnicoIdsParam, fechaDesde, fechaHasta],
  );

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // La pestaña se abre antes de pedir el PDF (si no, el navegador bloquea la ventana); si falla, se cierra y se avisa.
  async function verPdf(a: RetiroEquipoDoc) {
    if (pdfEnCurso) return;
    setPdfEnCurso(a._id);
    setErrorPdf(null);
    const win = window.open('', '_blank');
    try {
      const blob = await getRetiroEquipoPdf(await getIdToken(), a._id);
      const blobUrl = URL.createObjectURL(blob);
      if (win && !win.closed) {
        win.location.href = blobUrl;
      } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${a.modalidad === 'entrega' ? 'retiro' : 'entrega'}_equipo_${a.subtareaNombre || a._id}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      win?.close();
      setErrorPdf(err instanceof Error ? err.message : 'No se pudo abrir el PDF.');
    } finally {
      setPdfEnCurso(null);
    }
  }

  const activeFilters = useMemo(
    () =>
      [
        search && { key: 'search', label: `Buscar: "${search}"`, onRemove: () => setSearch('') },
        tecnicoIds.length > 0 && {
          key: 'tecnico',
          label: `${tecnicoIds.length === 1 ? 'Técnico' : 'Técnicos'}: ${tecnicoIds.map((id) => tecnicoNombrePorId.get(id) ?? id.slice(-6)).join(', ')}`,
          onRemove: () => setTecnicoIds([]),
        },
        modalidad && { key: 'modalidad', label: MODALIDAD_LABEL[modalidad], onRemove: () => setModalidad('') },
        fechaDesde && { key: 'desde', label: `Desde ${formatFechaHora(fechaDesde)}`, onRemove: () => setFechaDesde('') },
        fechaHasta && { key: 'hasta', label: `Hasta ${formatFechaHora(fechaHasta)}`, onRemove: () => setFechaHasta('') },
      ].filter((f): f is { key: string; label: string; onRemove: () => void } => Boolean(f)),
    [search, tecnicoIds, modalidad, fechaDesde, fechaHasta, tecnicoNombrePorId],
  );

  function limpiarFiltros() {
    setPage(1);
    setSearch('');
    setTecnicoIds([]);
    setModalidad('');
    setFechaDesde('');
    setFechaHasta('');
  }

  const botonPdf = (a: RetiroEquipoDoc) => (
    <button
      type="button"
      onClick={() => verPdf(a)}
      disabled={pdfEnCurso !== null}
      title="Ver el PDF del acta"
      aria-label="Ver el PDF del acta"
      className="flex h-[34px] w-[34px] items-center justify-center rounded-md bg-surface shadow-soft-sm disabled:opacity-40"
    >
      <IconDocument size={16} />
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-2xl font-extrabold">Actas de retiro y entrega</div>
        <div className="mt-0.5 text-sm font-semibold text-muted">
          {data ? `${data.total} actas` : 'Cargando...'} · El cliente entrega un equipo (retiro) o el técnico lo deja entregado, sin intervenir la unidad.
        </div>
      </div>

      <Card small className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="text-[13px] font-extrabold">Filtros</div>
            {activeFilters.length > 0 && <Badge tone="primary">{activeFilters.length}</Badge>}
          </div>
          <button
            type="button"
            onClick={() => setShowFiltros((v) => !v)}
            aria-expanded={showFiltros}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-bold text-primary sm:hidden"
          >
            {showFiltros ? 'Ocultar' : 'Más filtros'}
            <IconChevronDown className={`transition-transform ${showFiltros ? 'rotate-180' : ''}`} />
          </button>
          {activeFilters.length > 0 && (
            <button type="button" onClick={limpiarFiltros} className="flex items-center gap-1 text-[11.5px] font-bold text-muted hover:text-text">
              <IconX size={12} />
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            className="pl-10"
            placeholder="Unidad, cliente, N° de equipo, IMEI, quién entrega o N° de ticket..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        <div className={`${showFiltros ? 'grid' : 'hidden'} grid-cols-2 gap-3 sm:grid sm:grid-cols-4`}>
          <div>
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Técnico</div>
            <MultiSelectBuscable
              opciones={tecnicoOpciones}
              seleccionados={tecnicoIds}
              onChange={(ids) => {
                setPage(1);
                setTecnicoIds(ids);
              }}
              todosLabel="Todos"
              plural="técnicos"
              buscarPlaceholder="Escribí el nombre del técnico..."
              sinResultadosLabel="Ningún técnico coincide"
            />
          </div>

          <div>
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Tipo</div>
            <Select
              value={modalidad}
              onChange={(e) => {
                setPage(1);
                setModalidad(e.target.value as ModalidadRetiro | '');
              }}
            >
              <option value="">Todos</option>
              <option value="entrega">{MODALIDAD_LABEL.entrega}</option>
              <option value="deja_para_retirar">{MODALIDAD_LABEL.deja_para_retirar}</option>
            </Select>
          </div>

          <div>
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Desde</div>
            <Input
              type="date"
              value={fechaDesde}
              max={fechaHasta || undefined}
              onChange={(e) => {
                setPage(1);
                setFechaDesde(e.target.value);
              }}
            />
          </div>

          <div>
            <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">Hasta</div>
            <Input
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={(e) => {
                setPage(1);
                setFechaHasta(e.target.value);
              }}
            />
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
            {activeFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={f.onRemove}
                className="flex items-center gap-1.5 rounded-full bg-bg px-3 py-1 text-[11.5px] font-bold text-text shadow-inset"
              >
                {f.label}
                <IconX size={11} />
              </button>
            ))}
          </div>
        )}
      </Card>

      {error && <Card className="p-4 text-sm font-semibold text-bad">{error}</Card>}
      {errorPdf && <Card className="p-4 text-sm font-semibold text-bad">{errorPdf}</Card>}

      {/* < lg: una tarjeta por acta. */}
      <div className={`flex flex-col gap-3 transition-opacity lg:hidden ${loading && data ? 'opacity-60' : ''}`}>
        {loading && !data && <Card className="p-4 text-sm font-semibold text-muted">Cargando...</Card>}
        {!loading && data?.data.length === 0 && <Card className="p-4 text-sm font-semibold text-muted">No se encontraron actas.</Card>}
        {data?.data.map((a) => {
          const expanded = expandedIds.has(a._id);
          return (
            <Card key={a._id} className="overflow-hidden">
              <div className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-extrabold">{a.subtareaNombre || 'Sin unidad'}</div>
                    <div className="truncate text-[13px] font-semibold text-muted">{a.clienteNombre || '—'}</div>
                  </div>
                  <Badge tone={MODALIDAD_TONE[a.modalidad]}>{a.modalidad === 'entrega' ? 'Retiro' : 'Entrega'}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] font-semibold">
                  <div className="truncate text-muted">Equipo: <span className="text-text">{equipoResumen(a)}</span></div>
                  <div className="truncate text-muted">Ticket: <span className="text-text">{a.ticketOdooId ? `#${a.ticketOdooId}` : '—'}</span></div>
                  <div className="truncate text-muted">Téc.: <span className="text-text">{nombreTecnico(a)}</span></div>
                  <div className="truncate text-muted">{formatIsoDateTime(a.createdAt)}</div>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(a._id)}
                    aria-expanded={expanded}
                    className="flex min-h-10 items-center gap-1 rounded-md px-2 text-[12.5px] font-bold text-muted"
                  >
                    {expanded ? 'Ocultar detalle' : 'Ver detalle'}
                    <IconChevronDown className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  {botonPdf(a)}
                </div>
              </div>
              {expanded && (
                <div className="border-t border-line bg-bg p-4">
                  <DetalleActa a={a} />
                </div>
              )}
            </Card>
          );
        })}
        {data && (
          <Card className="pb-4">
            <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
          </Card>
        )}
      </div>

      <Card className="hidden p-2.5 pb-4 lg:block">
        <div className="overflow-x-auto">
          <div className="min-w-[1100px]">
            <div className="grid grid-cols-[32px_1.3fr_1.4fr_0.8fr_1.4fr_1fr_1.2fr_1fr_60px] pb-2.5 pt-4">
              {['', 'Unidad', 'Cliente', 'Ticket', 'Tipo', 'Equipo', 'Técnico', 'Fecha', ''].map((h, i) => (
                <div key={i} className="px-3.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  {h}
                </div>
              ))}
            </div>

            {loading && !data && <div className="px-3 py-6 text-sm font-semibold text-muted">Cargando...</div>}
            {!loading && data?.data.length === 0 && <div className="px-3 py-6 text-sm font-semibold text-muted">No se encontraron actas.</div>}

            <div className={`transition-opacity ${loading && data ? 'opacity-60' : ''}`}>
              {data?.data.map((a) => {
                const expanded = expandedIds.has(a._id);
                const estado = a.equipo?.estado || '';
                return (
                  <div key={a._id} className="border-t border-line">
                    <div
                      onClick={(e) => {
                        const selection = window.getSelection()?.toString();
                        if (selection && selection.trim().length > 0) return;
                        const target = e.target as HTMLElement | null;
                        if (target?.closest('button, a, input, [role="button"], label')) return;
                        toggleExpanded(a._id);
                      }}
                      className="grid cursor-pointer grid-cols-[32px_1.3fr_1.4fr_0.8fr_1.4fr_1fr_1.2fr_1fr_60px] items-center hover:bg-neutral-50/70"
                    >
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(a._id)}
                          title={expanded ? 'Ocultar detalle' : 'Ver detalle'}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg"
                        >
                          <IconChevronDown className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      <div className="p-3.5 text-[13px] font-bold text-primary">{a.subtareaNombre || 'Sin unidad'}</div>
                      <div className="p-3.5 text-[13px] font-semibold">{a.clienteNombre || '—'}</div>
                      <div className="p-3.5 text-[13px] font-semibold text-muted">{a.ticketOdooId ? `#${a.ticketOdooId}` : '—'}</div>
                      <div className="flex flex-col items-start gap-1 p-3.5">
                        <Badge tone={MODALIDAD_TONE[a.modalidad]}>{MODALIDAD_LABEL[a.modalidad]}</Badge>
                        {estado && <Badge tone={ESTADO_EQUIPO_TONE[estado]}>Equipo {ESTADO_EQUIPO_LABEL[estado].toLowerCase()}</Badge>}
                      </div>
                      <div className="p-3.5 text-[13px] font-semibold">{equipoResumen(a)}</div>
                      <div className="p-3.5 text-[13px] font-semibold text-muted">{nombreTecnico(a)}</div>
                      <div className="p-3.5 text-[13px] font-semibold text-muted">{formatIsoDateTime(a.createdAt)}</div>
                      <div className="p-3.5">{botonPdf(a)}</div>
                    </div>

                    {expanded && (
                      <div className="border-t border-line bg-bg px-4 py-4">
                        <DetalleActa a={a} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {data && <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
      </Card>
    </div>
  );
}
