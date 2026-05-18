"use client";

import Link from "next/link";
import { apiFetch } from "@/services/api";
import { formatBRL } from "../../../../utils/formatBRL";
import { useEffect, useMemo, useState } from "react";

type Analytics = {
  summary: {
    totalRestaurants: number;
    totalOrders: number;
    totalRevenue: number;
    totalUsers: number;
  };
  health?: {
    restaurantsWithoutOrders30d: number;
    restaurantsWithOpenInvoices: number;
    pastDueSubscriptions: number;
    suspendedSubscriptions: number;
    healthAlerts: Array<{
      id: string;
      name: string;
      slug: string;
      subscriptionStatus: string | null;
      orders30d: number;
      revenue30d: number;
      openInvoices: number;
      openAmount: number;
      reasons: string[];
      severity: "high" | "medium" | "low";
    }>;
  };
  topRestaurants: Array<{
    id: string;
    name: string;
    slug: string;
    totalOrders: number;
    totalRevenue: number;
  }>;
};

type BillingAutomationRunStats = {
  subscriptionsChecked: number;
  invoicesCreated: number;
  invoicesMarkedOverdue: number;
  subscriptionsActivated: number;
  subscriptionsPastDue: number;
  skippedWithFutureBilling: number;
  skippedWithoutNextBillingAt: number;
  duplicateReferencesIgnored: number;
};

type BillingAutomationHistoryEntry = {
  id: string;
  createdAt: string;
  finishedAt: string;
  trigger: "scheduler" | "manual";
  actorEmail?: string;
  ok: boolean;
  durationMs: number;
  stats: BillingAutomationRunStats;
  message: string;
  error?: string;
};

type BillingAutomationHistoryResponse = {
  data: BillingAutomationHistoryEntry[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
};

type BillingAutomationStatusResponse = {
  running: boolean;
  schedulerEnabled: boolean;
  nextRunAt: string | null;
};

export default function PlatformDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [automationStatus, setAutomationStatus] = useState<BillingAutomationStatusResponse | null>(null);
  const [lastAutomationRun, setLastAutomationRun] = useState<BillingAutomationHistoryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { summary, topRestaurants } = analytics || { summary: null, topRestaurants: [] };
  const averageTicket = useMemo(() => {
    const totalOrders = summary?.totalOrders || 0;
    const totalRevenue = summary?.totalRevenue || 0;
    if (totalOrders === 0) return 0;
    return totalRevenue / totalOrders;
  }, [summary?.totalOrders, summary?.totalRevenue]);

  const topRevenue = topRestaurants[0]?.totalRevenue || 0;
  const health = analytics?.health;

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      const [data, status, history] = await Promise.all([
        apiFetch<Analytics>("/platform/analytics"),
        apiFetch<BillingAutomationStatusResponse>("/platform/billing/automation/status"),
        apiFetch<BillingAutomationHistoryResponse>("/platform/billing/automation/history?limit=1"),
      ]);

      setAnalytics(data);
      setAutomationStatus(status);
      setLastAutomationRun(history.data[0] || null);
    } catch (error) {
      console.error("Erro ao carregar analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-900 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
              Controle executivo
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Dashboard da plataforma</h1>
            <p className="mt-2 max-w-2xl text-sm text-cyan-100/80 sm:text-base">
              Monitore crescimento da operacao, receita consolidada e desempenho das principais lojas em tempo real.
            </p>
          </div>
          <div className="grid w-full max-w-sm grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-100/80">Ticket medio</p>
              <p className="mt-1 text-xl font-black">{formatBRL(averageTicket)}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-100/80">Maior receita</p>
              <p className="mt-1 text-xl font-black">{formatBRL(topRevenue)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total de restaurantes", value: summary?.totalRestaurants || 0, note: "Lojas ativas" },
          { label: "Total de pedidos", value: summary?.totalOrders || 0, note: "Volume geral" },
          {
            label: "Receita consolidada",
            value: formatBRL(summary?.totalRevenue || 0),
            note: "Faturamento acumulado",
          },
          { label: "Total de usuarios", value: summary?.totalUsers || 0, note: "Equipe cadastrada" },
        ].map((item, index) => (
          <article
            key={item.label}
            className="surface-card interactive-lift stagger-fade rounded-2xl p-5"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{item.value}</p>
            <p className="mt-2 text-sm text-slate-500">{item.note}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="surface-card rounded-2xl p-5 sm:p-6">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">Top restaurantes</h2>
              <p className="text-sm text-slate-500">Ranking por receita e volume de pedidos</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Restaurante</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Slug</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Pedidos</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Receita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topRestaurants && topRestaurants.length > 0 ? (
                  topRestaurants.map((restaurant) => (
                    <tr key={restaurant.id} className="transition hover:bg-slate-50">
                      <td className="py-3 text-sm font-bold text-slate-900">{restaurant.name}</td>
                      <td className="py-3 text-sm text-slate-500">/{restaurant.slug}</td>
                      <td className="py-3 text-right text-sm font-semibold text-slate-900">{restaurant.totalOrders}</td>
                      <td className="py-3 text-right text-sm font-semibold text-blue-700">
                        {formatBRL(restaurant.totalRevenue)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-sm text-slate-500">
                      Nenhum restaurante cadastrado ainda
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="surface-card interactive-lift rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saude da operacao</p>
            <p className="mt-2 text-lg font-black text-slate-900">Plataforma em crescimento</p>
            <p className="mt-2 text-sm text-slate-500">
              Voce ja possui {summary?.totalRestaurants || 0} lojas ativas e {summary?.totalOrders || 0} pedidos processados.
            </p>
          </div>

          <div className="surface-card rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alertas operacionais</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Sem pedidos 30d</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{health?.restaurantsWithoutOrders30d || 0}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Com faturas abertas</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{health?.restaurantsWithOpenInvoices || 0}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Past due</p>
                <p className="mt-1 text-2xl font-black text-orange-700">{health?.pastDueSubscriptions || 0}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Suspensos</p>
                <p className="mt-1 text-2xl font-black text-red-700">{health?.suspendedSubscriptions || 0}</p>
              </div>
            </div>
          </div>

          <div className="surface-soft rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observacao</p>
            <p className="mt-2 text-sm text-slate-600">
              Conforme novas lojas entram, este painel evolui para previsoes de demanda, cohort de retencao e alertas de queda de faturamento.
            </p>
          </div>

          <div className="surface-soft rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Automacao de billing</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              Scheduler: {automationStatus?.schedulerEnabled ? "ativo" : "inativo"}
              {automationStatus?.running ? " (executando agora)" : ""}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Proxima execucao: {automationStatus?.nextRunAt
                ? new Date(automationStatus.nextRunAt).toLocaleString("pt-BR")
                : "nao agendada"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Ultima execucao: {lastAutomationRun
                ? new Date(lastAutomationRun.createdAt).toLocaleString("pt-BR")
                : "nenhum historico"}
            </p>
          </div>
        </aside>
      </section>

      <section className="surface-card rounded-2xl p-5 sm:p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">Alertas acionáveis</h2>
            <p className="text-sm text-slate-500">Restaurantes que precisam de atenção agora</p>
          </div>
          <Link href="/platform/admin/control-tower" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
            Abrir control tower
          </Link>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {health?.healthAlerts.length || 0} alertas
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {(health?.healthAlerts ?? []).length > 0 ? (
            health!.healthAlerts.map((alert) => (
              <article key={alert.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{alert.name}</p>
                    <p className="text-xs text-slate-500">/{alert.slug}</p>
                  </div>
                  <span
                    className={[
                      "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                      alert.severity === "high"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : alert.severity === "medium"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-white text-slate-700",
                    ].join(" ")}
                  >
                    {alert.severity === "high" ? "Crítico" : alert.severity === "medium" ? "Atenção" : "Baixo"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Pedidos 30d</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{alert.orders30d}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Receita 30d</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatBRL(alert.revenue30d)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Faturas abertas</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{alert.openInvoices}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Em aberto</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatBRL(alert.openAmount)}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {alert.reasons.map((reason) => (
                    <span key={reason} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                      {reason}
                    </span>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 xl:col-span-2">
              Nenhum alerta operacional no momento.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
