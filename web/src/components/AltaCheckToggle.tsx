'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { IconCheck } from '@/components/ui/Icons';
import { formatIsoDateTime } from '@/lib/format';
import type { AltaCheck } from '@/lib/types';

const AREA_LABEL: Record<'mesaAyuda' | 'coordinacion', string> = {
  mesaAyuda: 'Mesa de ayuda',
  coordinacion: 'Coordinación',
};

// api/src/models/Usuario.ts uses 'mesa_ayuda' (snake_case) for the role, but
// altaEquipo's sub-fields are 'mesaAyuda' (camelCase, matching the other
// Mongoose field names in Conformidad) — this bridges the two.
export function canToggleAlta(role: string | undefined, area: 'mesaAyuda' | 'coordinacion'): boolean {
  if (role === 'admin' || role === 'superadmin') return true;
  if (area === 'mesaAyuda') return role === 'mesa_ayuda';
  return role === 'coordinacion';
}

export function AltaCheckToggle({
  area,
  value,
  canToggle,
  usuarioNombre,
  onToggle,
  showDetail = false,
}: {
  area: 'mesaAyuda' | 'coordinacion';
  value: AltaCheck;
  canToggle: boolean;
  usuarioNombre?: (usuarioId: string) => string;
  onToggle: (checked: boolean) => Promise<void>;
  // Muestra quién marcó el check y cuándo como texto (no solo en el title del
  // hover) — para la card de detalle, donde no alcanza con un tooltip poco
  // descubrible. Las vistas compactas (listado, dashboard) lo dejan en false.
  showDetail?: boolean;
}) {
  const [saving, setSaving] = useState(false);

  async function handleClick() {
    if (!canToggle || saving) return;
    setSaving(true);
    try {
      await onToggle(!value.checked);
    } finally {
      setSaving(false);
    }
  }

  const quienYCuando = value.checked
    ? `${value.usuarioId && usuarioNombre ? usuarioNombre(value.usuarioId) : 'Alguien'}${
        value.fecha ? ` · ${formatIsoDateTime(value.fecha)}` : ''
      }`
    : null;

  const title = value.checked
    ? `${AREA_LABEL[area]}: dado de alta${quienYCuando ? ` por ${quienYCuando}` : ''}`
    : `${AREA_LABEL[area]}: pendiente de alta`;

  const badge = (
    <Badge tone={value.checked ? 'ok' : 'neutral'}>
      {value.checked && <IconCheck />}
      {value.checked ? 'Dado de alta' : 'Pendiente'}
    </Badge>
  );

  const trigger = canToggle ? (
    <button type="button" onClick={handleClick} disabled={saving} title={title} className="disabled:opacity-60">
      {badge}
    </button>
  ) : (
    <span title={title}>{badge}</span>
  );

  if (!showDetail) return trigger;

  return (
    <div className="flex flex-col gap-1">
      {trigger}
      {quienYCuando && <div className="text-[11px] font-semibold text-muted">{quienYCuando}</div>}
    </div>
  );
}
