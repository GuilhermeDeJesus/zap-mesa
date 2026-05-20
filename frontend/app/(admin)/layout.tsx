"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/auth.context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/dashboard/billing", label: "Billing", icon: "🧾" },
  { href: "/restaurant", label: "Restaurante", icon: "🏪" },
  { href: "/categories", label: "Categorias", icon: "📁" },
  { href: "/products", label: "Produtos", icon: "🍔" },
  { href: "/tables", label: "Mesas", icon: "🪑" },
  { href: "/orders", label: "Pedidos", icon: "📋" },
  { href: "/reports", label: "Relatórios", icon: "💰" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, restaurant, token, isLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace("/login");
    }
  }, [isLoading, token, router]);

  // Fecha sidebar ao navegar
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (isLoading || !token) return null;

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed_0%,_#f8fafc_28%,_#eef2ff_100%)] text-slate-900">
      {/* Botão hamburger mobile */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-white/90 border border-slate-200 rounded-full p-2 shadow-lg focus:outline-none"
        onClick={() => setSidebarOpen(true)}
        aria-label="Abrir menu"
      >
        <span className="block w-6 h-0.5 bg-slate-700 mb-1 rounded" />
        <span className="block w-6 h-0.5 bg-slate-700 mb-1 rounded" />
        <span className="block w-6 h-0.5 bg-slate-700 rounded" />
      </button>

      {/* Sidebar desktop e drawer mobile */}
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`
          fixed z-50 top-0 left-0 h-screen w-64 bg-white border-r border-white/70 shadow-[0_20px_50px_rgba(15,23,42,0.05)] flex flex-col shrink-0
          transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:static md:translate-x-0 md:flex
        `}
        style={{ maxWidth: 256 }}
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between md:block bg-white">
          <div>
            <p className="text-xl font-black tracking-tight text-orange-500">⚡ ZapMesa</p>
            <p className="text-xs text-slate-500 mt-2 truncate font-medium">
              {restaurant?.name ?? "Carregando..."}
            </p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
          {/* Botão fechar mobile */}
          <button
            className="md:hidden ml-2 p-1 rounded-full hover:bg-slate-100 text-2xl"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto bg-white">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.75 rounded-xl text-sm transition border ${
                  isActive
                    ? "bg-orange-50/80 text-orange-700 font-semibold border-orange-100 shadow-sm"
                    : "text-slate-700 border-transparent hover:bg-slate-50 hover:border-slate-200"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100 bg-white mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-red-600 rounded-xl hover:bg-red-50 transition"
          >
            🚪 Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo principal ocupa toda tela em mobile */}
      <main className="flex-1 overflow-auto p-3 sm:p-5 md:p-8 lg:p-10 transition-all max-w-6xl mx-auto px-2 sm:px-0 w-full">{children}</main>
    </div>
  );
}
