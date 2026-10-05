import { AuthGuard } from '@/components/AuthGuard';
import { MobileNav } from '@/components/MobileNav';
import { Sidebar } from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {/* < lg: sin sidebar; barra superior (~4.5rem) y barra inferior fijas, con espacio reservado para ambas. */}
      <div className="flex min-h-screen items-start gap-6 bg-bg px-3 pb-24 pt-[calc(4.5rem+env(safe-area-inset-top))] lg:p-6">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <MobileNav />
    </AuthGuard>
  );
}
