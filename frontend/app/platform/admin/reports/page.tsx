"use client";

import { apiFetch } from "@/services/api";
import { formatBRL } from "../../../../utils/formatBRL";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FinancialReportResponse = {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalRestaurants: number;
    activeSubscriptions: number;
    trialSubscriptions: number;
    pastDueSubscriptions: number;
    orderRevenue: number;
    deliveredOrders: number;
    paidInvoiceRevenue: number;
    paidInvoices: number;
    openInvoiceAmount: number;
    openInvoices: number;
    subscriptionRevenue: number;
    averageTicket: number;
    arr: number;
    trialToPaidConversion: number;
    arpu: number;
    ltvEstimated: number;
  };
  dailySeries: Array<{
    date: string;
    orderRevenue: number;
    paidInvoiceRevenue: number;
  }>;
  agingBuckets: Array<{
    key: string;
    label: string;
    count: number;
    amount: number;
  }>;
  forecast: {
    windowStart: string;
    windowEnd: string;
    subscriptionRevenue: number;
    openInvoiceRevenue: number;
    totalRevenue: number;
    activeRestaurants: number;
    byWeek: Array<{
      label: string;
      startDate: string;
      endDate: string;
      subscriptionRevenue: number;
      openInvoiceRevenue: number;
      totalRevenue: number;
    }>;
    horizons: Array<{
      days: number;
      totalRevenue: number;
      subscriptionRevenue: number;
      openInvoiceRevenue: number;
    }>;
  };
  collectionAlerts: {
    dueSoon7Days: number;
    dueSoon15Days: number;
    pastDue: number;
    suspended: number;
    items: Array<{
      id: string;
      name: string;
      slug: string;
      status: "due_soon" | "past_due" | "suspended";
      dueDate: string;
      amount: number;
      reason: string;
      action: string;
    }>;
  };
  topRestaurants: Array<{
    id: string;
    name: string;
    slug: string;
    orderRevenue: number;
    totalOrders: number;
    paidInvoiceRevenue: number;
    paidInvoices: number;
    openInvoiceAmount: number;
    openInvoices: number;
    overdueInvoiceAmount: number;
    overdueInvoices: number;
    totalRevenue: number;
  }>;
  invoiceStatusBreakdown: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
  retentionCuts: Array<{
    key: string;
    label: string;
    count: number;
    active: number;
    retentionRate: number;
    revenue: number;
  }>;
  planBreakdown: Array<{
    planName: string;
    count: number;
    mrr: number;
  }>;
  paymentMethodBreakdown: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
};

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function PlatformFinancialReportsPage() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return formatDateInput(date);
  });
  const [endDate, setEndDate] = useState(() => formatDateInput(new Date()));
  const [report, setReport] = useState<FinancialReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadReport();
  }, []);

  async function loadReport() {
    try {
      setIsLoading(true);
      setError("");
      const query = new URLSearchParams({ startDate, endDate });
      const data = await apiFetch<FinancialReportResponse>(`/platform/reports/financial?${query.toString()}`);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar relatório financeiro");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefresh() {
    try {
      setIsRefreshing(true);
      await loadReport();
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleExportCsv() {
    if (!report) return;

    const rows = [
      ["seção", "item", "valor", "quantidade"],
      ["resumo", "receita_pedidos", String(report.summary.orderRevenue), String(report.summary.deliveredOrders)],
      ["resumo", "receita_recorrente", String(report.summary.paidInvoiceRevenue), String(report.summary.paidInvoices)],
      ["resumo", "mrr", String(report.summary.subscriptionRevenue), String(report.summary.activeSubscriptions)],
      ["resumo", "arr", String(report.summary.arr), ""],
      ["resumo", "arpu", String(report.summary.arpu), ""],
      ["resumo", "ltv_estimated", String(report.summary.ltvEstimated), ""],
      ["resumo", "em_aberto", String(report.summary.openInvoiceAmount), String(report.summary.openInvoices)],
      ["resumo", "conversao_trial_pago", String(report.summary.trialToPaidConversion), ""],
      ...report.planBreakdown.map((item) => ["plano", item.planName, String(item.mrr), String(item.count)]),
      ...report.paymentMethodBreakdown.map((item) => ["pagamento", item.method, String(item.amount), String(item.count)]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-financeiro-${startDate}-a-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handlePrintPdf() {
    window.print();
  }

  const maxDayRevenue = useMemo(
    () => Math.max(...(report?.dailySeries ?? []).map((entry) => entry.orderRevenue + entry.paidInvoiceRevenue), 1),
    [report]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-cyan-950 to-teal-800 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">Relatório financeiro</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Faturamento da plataforma</h1>
            <p className="mt-2 max-w-2xl text-sm text-cyan-100/80 sm:text-base">
              Acompanhe receita de pedidos, cobranças recorrentes, inadimplência e a saúde financeira dos restaurantes em um único lugar.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur sm:flex-row sm:items-end">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-cyan-100/80">Início</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border border-white/20 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-cyan-100/80">Fim</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl border border-white/20 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-50 disabled:opacity-50"
            >
              {isRefreshing ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Imprimir / PDF
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: "Receita pedidos", value: formatBRL(report?.summary.orderRevenue || 0) },
          { label: "Receita recorrente", value: formatBRL(report?.summary.paidInvoiceRevenue || 0) },
          { label: "Em aberto", value: formatBRL(report?.summary.openInvoiceAmount || 0) },
          { label: "MRR atual", value: formatBRL(report?.summary.subscriptionRevenue || 0) },
          { label: "Pedidos entregues", value: String(report?.summary.deliveredOrders || 0) },
          { label: "Faturas pagas", value: String(report?.summary.paidInvoices || 0) },
          { label: "Assinaturas ativas", value: String(report?.summary.activeSubscriptions || 0) },
          { label: "Ticket médio", value: formatBRL(report?.summary.averageTicket || 0) },
          { label: "ARR", value: formatBRL(report?.summary.arr || 0) },
          { label: "ARPU", value: formatBRL(report?.summary.arpu || 0) },
          { label: "LTV estimado", value: formatBRL(report?.summary.ltvEstimated || 0) },
          { label: "Conversão trial → pago", value: `${Math.round((report?.summary.trialToPaidConversion || 0) * 100)}%` },
        ].map((item) => (
          <article key={item.label} className="surface-card rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="surface-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">Receita diária</h2>
              <p className="text-sm text-slate-500">Pedidos entregues + faturas pagas no período</p>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {report?.period.startDate ? formatShortDate(report.period.startDate) : "--"} até {report?.period.endDate ? formatShortDate(report.period.endDate) : "--"}
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {(report?.dailySeries ?? []).length > 0 ? (
              report!.dailySeries.map((entry) => {
                const total = entry.orderRevenue + entry.paidInvoiceRevenue;
                const width = Math.max((total / maxDayRevenue) * 100, total > 0 ? 6 : 0);
                return (
                  <div key={entry.date} className="grid grid-cols-[76px_1fr_120px] items-center gap-3">
                    <span className="text-xs font-semibold text-slate-500">{formatShortDate(entry.date)}</span>
                    <div className="h-3 rounded-full bg-slate-100">
                      <div className="h-3 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500" style={{ width: `${width}%` }} />
                    </div>
                    <span className="text-right text-xs font-semibold text-slate-700">{formatBRL(total)}</span>
                  </div>
                );
              })
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">Sem dados para o período selecionado.</p>
            )}
          </div>
        </article>

        <article className="surface-card rounded-2xl p-5 sm:p-6">
          <h2 className="text-xl font-black text-slate-900">Aging de cobrança</h2>
          <p className="text-sm text-slate-500">Distribuição de faturas pendentes e vencidas por faixa de atraso</p>

          <div className="mt-4 space-y-3">
            {(report?.agingBuckets ?? []).map((bucket) => (
              <div key={bucket.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{bucket.label}</p>
                  <p className="text-sm font-bold text-slate-900">{bucket.count} faturas</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatBRL(bucket.amount)}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">Previsão de receita</h2>
            <p className="text-sm text-slate-500">Projeção baseada em assinaturas ativas e faturas em aberto</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {report?.forecast?.windowStart ? formatShortDate(report.forecast.windowStart) : "--"} até {report?.forecast?.windowEnd ? formatShortDate(report.forecast.windowEnd) : "--"}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[
            { label: "Assinaturas previstas", value: formatBRL(report?.forecast?.subscriptionRevenue || 0) },
            { label: "Faturas em aberto", value: formatBRL(report?.forecast?.openInvoiceRevenue || 0) },
            { label: "Receita projetada", value: formatBRL(report?.forecast?.totalRevenue || 0) },
            { label: "Restaurantes ativos", value: String(report?.forecast?.activeRestaurants || 0) },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
          {(report?.forecast?.byWeek ?? []).map((week) => (
            <div key={week.label} className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">{week.label}</p>
              <p className="mt-2 text-lg font-black text-slate-900">{formatBRL(week.totalRevenue)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {formatBRL(week.subscriptionRevenue)} recorrente + {formatBRL(week.openInvoiceRevenue)} aberto
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {(report?.forecast?.horizons ?? []).map((horizon) => (
            <div key={horizon.days} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{horizon.days} dias</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{formatBRL(horizon.totalRevenue)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {formatBRL(horizon.subscriptionRevenue)} recorrente + {formatBRL(horizon.openInvoiceRevenue)} em aberto
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="surface-card rounded-2xl p-5 sm:p-6">
          <h2 className="text-xl font-black text-slate-900">Quebra por plano</h2>
          <p className="text-sm text-slate-500">MRR e quantidade por plano cadastrado</p>
          <div className="mt-4 space-y-3">
            {(report?.planBreakdown ?? []).length > 0 ? (
              report!.planBreakdown.map((item) => (
                <div key={item.planName} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{item.planName}</p>
                    <p className="text-sm font-bold text-slate-900">{item.count} lojas</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">MRR: {formatBRL(item.mrr)}</p>
                </div>
              ))
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">Sem planos para exibir.</p>
            )}
          </div>
        </article>

        <article className="surface-card rounded-2xl p-5 sm:p-6">
          <h2 className="text-xl font-black text-slate-900">Forma de pagamento</h2>
          <p className="text-sm text-slate-500">Cobranças pagas no período por método</p>
          <div className="mt-4 space-y-3">
            {(report?.paymentMethodBreakdown ?? []).length > 0 ? (
              report!.paymentMethodBreakdown.map((item) => (
                <div key={item.method} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{item.method}</p>
                    <p className="text-sm font-bold text-slate-900">{item.count} pagas</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatBRL(item.amount)}</p>
                </div>
              ))
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">Sem pagamentos no período.</p>
            )}
          </div>
        </article>
      </section>

      <section className="surface-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">Cortes de retenção</h2>
            <p className="text-sm text-slate-500">Restaurantes ativos por faixa de tempo desde a criação</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
          {(report?.retentionCuts ?? []).map((cut) => (
            <div key={cut.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{cut.label}</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{Math.round(cut.retentionRate * 100)}%</p>
              <p className="mt-1 text-xs text-slate-500">
                {cut.active} ativos de {cut.count} lojas · {formatBRL(cut.revenue)} de MRR
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">Alertas de cobrança</h2>
            <p className="text-sm text-slate-500">Fila curta para agir antes do vencimento ou na inadimplência</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-4">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5">7 dias: {report?.collectionAlerts?.dueSoon7Days || 0}</span>
            <span className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1.5">15 dias: {report?.collectionAlerts?.dueSoon15Days || 0}</span>
            <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5">Past due: {report?.collectionAlerts?.pastDue || 0}</span>
            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5">Suspensos: {report?.collectionAlerts?.suspended || 0}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {(report?.collectionAlerts?.items ?? []).length > 0 ? (
            report!.collectionAlerts.items.map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{alert.name}</p>
                    <p className="text-xs text-slate-500">/{alert.slug}</p>
                  </div>
                  <span className={[
                    "rounded-full border px-2.5 py-1 text-xs font-semibold",
                    alert.status === "suspended"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : alert.status === "past_due"
                        ? "border-orange-200 bg-orange-50 text-orange-700"
                        : "border-amber-200 bg-amber-50 text-amber-700",
                  ].join(" ")}>
                    {alert.reason}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Vencimento</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{new Date(alert.dueDate).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Valor</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatBRL(alert.amount)}</p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-600">Ação sugerida: {alert.action}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/platform/admin/restaurants/${alert.id}`}
                    className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700"
                  >
                    Abrir restaurante
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 xl:col-span-2">
              Nenhum alerta de cobrança no período.
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="surface-card rounded-2xl p-5 sm:p-6">
          <h2 className="text-xl font-black text-slate-900">Top restaurantes por faturamento</h2>
          <p className="text-sm text-slate-500">Somando pedidos entregues e faturas pagas no período</p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Restaurante</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Pedidos</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Pedidos R$</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Cobrança R$</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Em aberto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(report?.topRestaurants ?? []).length > 0 ? (
                  report!.topRestaurants.map((restaurant) => (
                    <tr key={restaurant.id} className="transition hover:bg-slate-50">
                      <td className="py-3">
                        <p className="text-sm font-bold text-slate-900">{restaurant.name}</p>
                        <p className="text-xs text-slate-500">/{restaurant.slug}</p>
                      </td>
                      <td className="py-3 text-right text-sm font-semibold text-slate-900">{restaurant.totalOrders}</td>
                      <td className="py-3 text-right text-sm font-semibold text-cyan-700">{formatBRL(restaurant.orderRevenue)}</td>
                      <td className="py-3 text-right text-sm font-semibold text-emerald-700">{formatBRL(restaurant.paidInvoiceRevenue)}</td>
                      <td className="py-3 text-right text-sm font-semibold text-orange-700">
                        {formatBRL(restaurant.openInvoiceAmount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                      Sem restaurantes no período
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="surface-card rounded-2xl p-5 sm:p-6">
          <h2 className="text-xl font-black text-slate-900">Status das faturas</h2>
          <p className="text-sm text-slate-500">Resumo das faturas encontradas no período</p>

          <div className="mt-4 grid grid-cols-1 gap-3">
            {(report?.invoiceStatusBreakdown ?? []).map((item) => (
              <div key={item.status} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.status}</p>
                  <p className="text-sm font-bold text-slate-900">{item.count}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatBRL(item.amount)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-cyan-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observação</p>
            <p className="mt-1 text-sm text-slate-600">
              A receita consolidada soma pedidos entregues e faturas pagas. O em aberto mostra o risco atual da base.
            </p>
          </div>
        </article>
      </section>

      <div className="flex justify-end">
        <Link href="/platform/admin/billing" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          Ver mensalidades
        </Link>
      </div>
    </div>
  );
}
