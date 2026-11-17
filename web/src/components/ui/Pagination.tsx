// Paginador genérico para listados server-paginados (ver `Paginated<T>` en
// lib/types.ts) — usado por conformidades, actas, incidencias y reportes/visitas,
// las tablas que traen más registros de los que Mongo debería devolver
// de una. Muestra los números de página (con "…" cuando son muchas) además de
// Anterior/Siguiente, para poder saltar directo a una página.

type Item = number | 'gap-start' | 'gap-end';

// Siempre la primera, la última y las vecinas de la actual. Hasta 7 páginas se
// muestran todas; con más, los huecos se marcan con "…". Si el hueco sería de
// una sola página se muestra esa página en vez de "…" (no ahorra lugar).
function pageItems(page: number, totalPages: number): Item[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  let start = Math.max(2, page - 1);
  let end = Math.min(totalPages - 1, page + 1);
  // Cerca de los bordes se muestran más páginas de ese lado para que la cantidad de botones no salte.
  if (page <= 3) end = 5;
  if (page >= totalPages - 2) start = totalPages - 4;
  const items: Item[] = [1];
  if (start === 3) items.push(2);
  else if (start > 3) items.push('gap-start');
  for (let p = start; p <= end; p++) items.push(p);
  if (end === totalPages - 2) items.push(totalPages - 1);
  else if (end < totalPages - 2) items.push('gap-end');
  items.push(totalPages);
  return items;
}

const navBtn =
  'flex h-8 items-center rounded-md px-2.5 text-xs font-bold text-muted shadow-inset transition hover:text-text disabled:pointer-events-none disabled:opacity-40';

export function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col items-center gap-3 px-2.5 pt-4 sm:flex-row sm:justify-between">
      <div className="text-[12.5px] font-semibold text-muted">
        Página {page} de {totalPages}
      </div>
      <nav aria-label="Paginación" className="flex flex-wrap items-center justify-center gap-1.5">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className={navBtn} aria-label="Página anterior">
          <span aria-hidden className="sm:hidden">‹</span>
          <span className="hidden sm:inline">Anterior</span>
        </button>
        {pageItems(page, totalPages).map((item) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              onClick={() => item !== page && onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
              className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-bold tabular-nums transition ${
                item === page ? 'bg-primary-600 text-white' : 'text-muted shadow-inset hover:text-text'
              }`}
            >
              {item}
            </button>
          ) : (
            <span key={item} aria-hidden className="flex h-8 min-w-6 items-center justify-center text-xs font-bold text-muted">
              …
            </span>
          ),
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={navBtn}
          aria-label="Página siguiente"
        >
          <span aria-hidden className="sm:hidden">›</span>
          <span className="hidden sm:inline">Siguiente</span>
        </button>
      </nav>
    </div>
  );
}
