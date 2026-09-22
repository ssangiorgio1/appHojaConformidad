// Paginador genérico para listados server-paginados (ver `Paginated<T>` en
// lib/types.ts) — usado por conformidades, incidencias y reportes/visitas,
// las tres tablas que traen más registros de los que Mongo debería devolver
// de una — evita triplicar el mismo par de botones Anterior/Siguiente.
export function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-2.5 pt-4">
      <div className="text-[12.5px] font-semibold text-muted">
        Página {page} de {totalPages}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md px-3 py-1.5 text-xs font-bold text-muted shadow-inset disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md px-3 py-1.5 text-xs font-bold text-muted shadow-inset disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
