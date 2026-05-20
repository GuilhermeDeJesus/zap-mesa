"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../services/api";
import { useAuth } from "../../../contexts/auth.context";
import type { Order, Product, Table } from "../../../types";

export default function DashboardPage() {
  const { restaurant } = useAuth();
  const [counts, setCounts] = useState({ products: 0, tables: 0, pendingOrders: 0 });

  useEffect(() => {
    void (async () => {
      const [products, tables, orders] = await Promise.all([
        apiFetch<Product[]>("/products"),
        apiFetch<Table[]>("/tables"),
        apiFetch<Order[]>("/orders?status=pending"),
      ]);
      setCounts({
        products: products.length,
        tables: tables.length,
        pendingOrders: orders.length,
      });
    })();
  }, []);

  const menuUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/menu/${restaurant?.slug ?? ""}`
      : "";

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-2xl sm:rounded-3xl bg-slate-900 text-white p-4 sm:p-6 md:p-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)] overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,146,60,0.22),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.08),_transparent_28%)]" />
        <div className="relative flex flex-col gap-3 sm:gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-orange-200/70 mb-1 sm:mb-2">Operação do restaurante</p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">Dashboard</h1>
            <p className="text-slate-300 mt-1 sm:mt-2 text-xs sm:text-sm md:text-base max-w-2xl">
              {restaurant?.name} em uma visão rápida, simples e focada no que importa para o dia a dia.
            </p>
          </div>
          <div className="rounded-xl sm:rounded-2xl bg-white/10 border border-white/10 px-3 py-2 sm:px-4 sm:py-3 backdrop-blur-sm mt-2 md:mt-0">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Cardápio público</p>
            <code className="text-xs sm:text-sm text-orange-100 break-all">{menuUrl || "..."}</code>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard title="Produtos ativos" value={counts.products} color="orange" />
        <StatCard title="Mesas cadastradas" value={counts.tables} color="blue" />
        <StatCard title="Pedidos pendentes" value={counts.pendingOrders} color="green" />
      </div>

      <div className="bg-white/90 backdrop-blur rounded-2xl sm:rounded-3xl border border-white/70 p-4 sm:p-5 md:p-6 shadow-sm">
        <p className="text-xs sm:text-sm font-semibold text-slate-700 mb-2">Link do cardápio público</p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <code className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-slate-700 truncate">
            {menuUrl}
          </code>
          <button
            onClick={() => { void navigator.clipboard.writeText(menuUrl); }}
            className="text-xs bg-orange-500 text-white px-4 py-2.5 rounded-2xl hover:bg-orange-600 transition shadow-sm"
          >
            Copiar
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: "orange" | "blue" | "green";
}) {
  const colors = {
    orange: "border-orange-200 bg-orange-50/90 text-orange-700",
    blue: "border-blue-200 bg-blue-50/90 text-blue-700",
    green: "border-green-200 bg-green-50/90 text-green-700",
  };
  return (
    <div className={`rounded-2xl sm:rounded-3xl border p-4 sm:p-5 shadow-sm flex flex-col items-start ${colors[color]}`}>
      <p className="text-2xl sm:text-3xl font-black tracking-tight">{value}</p>
      <p className="text-xs sm:text-sm mt-1 opacity-80">{title}</p>
    </div>
  );
}
