import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen items-start gap-6 bg-bg p-6">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </AuthGuard>
  );
}
