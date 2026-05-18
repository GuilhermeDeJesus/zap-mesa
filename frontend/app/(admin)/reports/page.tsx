"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../services/api";
import {
  ORDER_STATUS_LABEL,
  type ReportsData,
  type ReportsSeriesPoint,
} from "../../../types";

type Preset = "7d" | "30d" | "90d";

function getPresetRange(preset: Preset): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  const days = preset === "7d" ? 6 : preset === "30d" ? 29 : 89;
  start.setDate(end.getDate() - days);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [startDate, setStartDate] = useState(getPresetRange("30d").startDate);
  const [endDate, setEndDate] = useState(getPresetRange("30d").endDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<ReportsData | null>(null);

  async function loadReports(from: string, to: string) {
    setLoading(true);
    setError("");
    try {
      const report = await apiFetch<ReportsData>(`/reports/summary?startDate=${from}&endDate=${to}`);
      setData(report);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar relatório");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports(startDate, endDate);
  }, []);

  function applyPreset(nextPreset: Preset) {
    const range = getPresetRange(nextPreset);
    setPreset(nextPreset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    void loadReports(range.startDate, range.endDate);
  }

  function applyCustomRange() {
    setPreset("30d");
    void loadReports(startDate, endDate);
  }

  const maxRevenue = useMemo(() => {
    if (!data?.series.length) return 0;
    return Math.max(...data.series.map((point) => point.revenue));
  }, [data?.series]);

  return (
    <div className="max-w-7xl space-y-6">
      <section className="rounded-3xl bg-white/90 backdrop-blur border border-white/70 shadow-sm p-6 md:p-7">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500 font-semibold">Business Intelligence</p>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 mt-1">Relatórios e Faturamento</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Visão financeira rápida para acompanhar receita, volume de pedidos e produtos que mais vendem.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <PresetButton active={preset === "7d"} onClick={() => applyPreset("7d")} label="Últimos 7 dias" />
          <PresetButton active={preset === "30d"} onClick={() => applyPreset("30d")} label="Últimos 30 dias" />
          <PresetButton active={preset === "90d"} onClick={() => applyPreset("90d")} label="Últimos 90 dias" />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 bg-white"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 bg-white"
          />
          <button
            onClick={applyCustomRange}
            className="bg-orange-500 text-white text-sm px-5 py-3 rounded-2xl hover:bg-orange-600 transition shadow-sm"
          >
            Aplicar período
          </button>
        </div>
      </section>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          {error}
        </p>
      )}

      {loading && <p className="text-slate-500">Carregando relatório...</p>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard label="Faturamento bruto" value={money(data.summary.grossRevenue)} tone="orange" />
            <KpiCard label="Faturamento entregue" value={money(data.summary.deliveredRevenue)} tone="green" />
            <KpiCard label="Pedidos no período" value={String(data.summary.totalOrders)} tone="blue" />
            <KpiCard label="Ticket médio" value={money(data.summary.averageTicket)} tone="purple" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4">
            <section className="bg-white/90 backdrop-blur rounded-3xl border border-white/70 p-5 md:p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Faturamento por dia</h2>
              <p className="text-xs text-slate-500 mt-1 mb-4">Soma de pedidos não cancelados por data</p>

              {data.series.length === 0 && (
                <p className="text-sm text-slate-400 py-6">Sem dados no período selecionado.</p>
              )}

              <div className="space-y-2">
                {data.series.slice(-12).map((point) => (
                  <RevenueRow key={point.date} point={point} maxRevenue={maxRevenue} />
                ))}
              </div>
            </section>

            <section className="bg-white/90 backdrop-blur rounded-3xl border border-white/70 p-5 md:p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Pedidos por status</h2>
              <div className="mt-4 space-y-2">
                {(Object.keys(data.statusCounts) as Array<keyof typeof data.statusCounts>).map((status) => (
                  <div key={status} className="flex items-center justify-between text-sm border border-slate-100 rounded-xl px-3 py-2">
                    <span className="text-slate-600">{ORDER_STATUS_LABEL[status]}</span>
                    <span className="font-semibold text-slate-800">{data.statusCounts[status]}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="bg-white/90 backdrop-blur rounded-3xl border border-white/70 p-5 md:p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Top produtos</h2>
            <p className="text-xs text-slate-500 mt-1 mb-4">Ranking por faturamento no período</p>

            {data.topProducts.length === 0 && (
              <p className="text-sm text-slate-400 py-6">Sem vendas registradas no período.</p>
            )}

            {data.topProducts.length > 0 && (
              <div className="divide-y divide-slate-100">
                {data.topProducts.map((product, index) => (
                  <div key={product.productId} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">#{index + 1} {product.name}</p>
                      <p className="text-xs text-slate-500">{product.quantity} unidade(s)</p>
                    </div>
                    <p className="text-sm font-bold text-orange-600">{money(product.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PresetButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-4 py-2 rounded-full border transition ${
        active
          ? "bg-orange-500 text-white border-orange-500"
          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "orange" | "green" | "blue" | "purple";
}) {
  const toneStyles = {
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    green: "bg-green-50 border-green-200 text-green-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    purple: "bg-indigo-50 border-indigo-200 text-indigo-700",
  };

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneStyles[tone]}`}>
      <p className="text-xs uppercase tracking-[0.15em] opacity-70">{label}</p>
      <p className="text-2xl font-black mt-2 tracking-tight">{value}</p>
    </div>
  );
}

function RevenueRow({ point, maxRevenue }: { point: ReportsSeriesPoint; maxRevenue: number }) {
  const percent = maxRevenue > 0 ? Math.max(6, (point.revenue / maxRevenue) * 100) : 0;

  return (
    <div className="grid grid-cols-[78px_1fr_auto] items-center gap-3">
      <p className="text-xs text-slate-500">{point.date.slice(5)}</p>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-orange-400 rounded-full" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs font-semibold text-slate-700">{money(point.revenue)}</p>
    </div>
  );
}

function money(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
