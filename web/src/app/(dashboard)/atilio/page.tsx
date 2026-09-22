import { Card } from '@/components/ui/Card';
import { IconSparkle } from '@/components/ui/Icons';

// Placeholder de la sección Atilio (asistente de IA que va a traer el estado
// de reporte del equipo) — ver fixesVarios.md del repo de la PWA. Sin lógica
// real todavía: la integración depende de una API que todavía no está
// documentada.
export default function AtilioPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-2xl font-extrabold">Atilio</div>
      </div>

      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          <IconSparkle size={28} />
        </div>
        <div className="text-[17px] font-extrabold text-text">Próximamente</div>
        <div className="max-w-sm text-[13.5px] leading-relaxed text-muted">
          Vas a poder consultar acá el estado de reporte de cada equipo sin salir del panel.
        </div>
      </Card>
    </div>
  );
}
