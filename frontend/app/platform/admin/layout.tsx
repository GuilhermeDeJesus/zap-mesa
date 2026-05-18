"use client";

import { useAuth } from "@/contexts/auth.context";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { href: "/platform/admin/dashboard", label: "Dashboard" },
      { href: "/platform/admin/control-tower", label: "Control Tower" },
      { href: "/platform/admin/reports", label: "Relatórios" },
      { href: "/platform/admin/restaurants", label: "Restaurantes" },
      { href: "/platform/admin/billing", label: "Mensalidades" },
      { href: "/platform/admin/payments", label: "Pagamentos" },
    ],
    []
  );

  useEffect(() => {
    if (!isLoading) {
      if (!user || user.role !== "PLATFORM_OWNER") {
        router.push("/login");
      } else {
        setIsAuthorized(true);
      }
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Show loading while checking auth
  if (isLoading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e0ecff_0%,#f5f9ff_35%,#f8fafc_100%)] text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur lg:hidden">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-blue-700">ZapMesa</p>
            <p className="text-xs text-slate-500">Painel da plataforma</p>
          </div>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Menu
          </button>
        </div>
      </header>

      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside
          className={[
            "fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200/70 bg-white p-5 shadow-2xl transition-transform lg:static lg:w-auto lg:translate-x-0 lg:shadow-none",
            isMenuOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 p-4 text-white shadow-lg">
            <p className="text-lg font-bold">ZapMesa</p>
            <p className="text-xs text-blue-100">Gestao central da plataforma</p>
          </div>

          <nav className="mt-6 space-y-2">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "block rounded-xl px-4 py-3 text-sm font-semibold transition",
                    active
                      ? "bg-blue-600 text-white shadow"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conta ativa</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
            <button
              type="button"
              onClick={logout}
              className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
            >
              Sair da conta
            </button>
          </div>
        </aside>

        {isMenuOpen && (
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
            onClick={() => setIsMenuOpen(false)}
          />
        )}

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-4 shadow-sm backdrop-blur sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
