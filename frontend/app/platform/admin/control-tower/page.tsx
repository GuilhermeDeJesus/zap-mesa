"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/services/api";
import { formatBRL } from "../../../../utils/formatBRL";

type ControlTowerResponse = {
  score: {
    overall: number;
    operational: number;
    financial: number;
  };
  summary: {
    totalRestaurants: number;
    activeSubscriptions: number;
    trialSubscriptions: number;
    pastDueSubscriptions: number;
    suspendedSubscriptions: number;
    restaurantsWithoutOrders30d: number;
    restaurantsWithOpenInvoices: number;
    openInvoiceAmount: number;
    alertsCount: number;
  };
  alerts: Array<{
    id: string;
    name: string;
    slug: string;
    restaurantId: string;
    severity: "high" | "medium" | "low";
    category: "billing" | "operational" | "financial";
    title: string;
    reason: string;
    action: string;
    status: string | null;
    amount: number;
    dueDate: string | null;
    recommendedStatus: "active" | "past_due" | null;
  }>;
  timeline: Array<{
    id: string;
    kind: "audit" | "automation";
    title: string;
    description: string;
    restaurantName: string | null;
    createdAt: string;
    severity: "high" | "medium" | "low";
    href?: string;
  }>;
  topRestaurants: Array<{
    id: string;
    name: string;
    slug: string;
    totalOrders: number;
    totalRevenue: number;
  }>;
  quickActions: Array<{
    label: string;
    href: string;
  }>;
  revenueTrend: {
    current30d: number;
    previous30d: number;
    changePercent: number;
  };
  review: {
    dueSoon7Days: number;
    dueSoon15Days: number;
    overdueSubscriptions: number;
  };
};

const severityStyles: Record<"high" | "medium" | "low", string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

export default function ControlTowerPage() {
  const [data, setData] = useState<ControlTowerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyRestaurantId, setBusyRestaurantId] = useState<string | null>(null);

  useEffect(() => {
    void loadControlTower();
  }, []);

  async function loadControlTower() {
    try {
      setIsLoading(true);
      setError("");
      const response = await apiFetch<ControlTowerResponse>("/platform/control-tower");
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar control tower");
    } finally {
      setIsLoading(false);
    }
  }

  async function updateBillingStatus(restaurantId: string, status: "active" | "past_due" | "suspended") {
    try {
      setBusyRestaurantId(restaurantId);
      await apiFetch(`/platform/restaurants/${restaurantId}/billing/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadControlTower();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar status da assinatura");
    } finally {
      setBusyRestaurantId(null);
    }
  }

  async function copyReminder(alert: ControlTowerResponse["alerts"][number]) {
    const message = [
      `Olá, ${alert.name}.`,
      `Identificamos ${alert.reason}.`,
      `Valor relacionado: ${formatBRL(alert.amount)}.`,
      `Acompanhe os detalhes em /platform/admin/restaurants/${alert.restaurantId}`,
    ].join(" ");

    await navigator.clipboard.writeText(message);
  }

  const scoreGradient = useMemo(() => {
    const score = data?.score.overall || 0;
    return `conic-gradient(#0ea5e9 0deg ${score * 3.6}deg, #e2e8f0 ${score * 3.6}deg 360deg)`;
  }, [data?.score.overall]);

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
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">Control tower</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Painel único da plataforma</h1>
            <p className="mt-2 max-w-2xl text-sm text-cyan-100/80 sm:text-base">
              Um semáforo com score operacional e financeiro, alertas acionáveis e uma timeline consolidada de eventos.
            </p>
          </div>
          <div className="grid w-full max-w-sm grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-100/80">Score geral</p>
              <p className="mt-1 text-xl font-black">{data?.score.overall || 0}/100</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-100/80">Alertas</p>
              <p className="mt-1 text-xl font-black">{data?.summary.alertsCount || 0}</p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
        <article className="surface-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Semáforo</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">Saúde da operação</h2>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-black text-slate-900">
              {data?.score.overall || 0}
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <div className="relative h-52 w-52 rounded-full border border-slate-200 bg-white p-4 shadow-inner">
              <div className="flex h-full items-center justify-center rounded-full" style={{ background: scoreGradient }}>
                <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score geral</p>
                  <p className="text-4xl font-black text-slate-900">{data?.score.overall || 0}</p>
                  <p className="text-xs text-slate-500">de 100</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Operacional</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{data?.score.operational || 0}/100</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Financeiro</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{data?.score.financial || 0}/100</p>
            </div>
          </div>
        </article>

        <article className="surface-card rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Métricas principais</p>
              <h2 className="mt-1 text-xl font-black text-slate-900">Resumo executivo</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {(data?.quickActions || []).map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Restaurantes", value: data?.summary.totalRestaurants || 0 },
              { label: "Ativos", value: data?.summary.activeSubscriptions || 0 },
              { label: "Past due", value: data?.summary.pastDueSubscriptions || 0 },
              { label: "Suspensos", value: data?.summary.suspendedSubscriptions || 0 },
              { label: "Sem pedidos 30d", value: data?.summary.restaurantsWithoutOrders30d || 0 },
              { label: "Com faturas abertas", value: data?.summary.restaurantsWithOpenInvoices || 0 },
              { label: "Atraso 7 dias", value: data?.review.dueSoon7Days || 0 },
              { label: "Atraso 15 dias", value: data?.review.dueSoon15Days || 0 },
              { label: "Receita 30d", value: formatBRL(data?.revenueTrend.current30d || 0) },
              { label: "Variação", value: `${Math.round(data?.revenueTrend.changePercent || 0)}%` },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-cyan-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tendência de receita</p>
            <p className="mt-2 text-lg font-black text-slate-900">
              {formatBRL(data?.revenueTrend.current30d || 0)} vs {formatBRL(data?.revenueTrend.previous30d || 0)}
            </p>
            <p className={[
              "mt-1 text-sm font-semibold",
              (data?.revenueTrend.changePercent || 0) < 0 ? "text-red-700" : "text-emerald-700",
            ].join(" ")}>
              {Math.round(data?.revenueTrend.changePercent || 0)}% em relação aos 30 dias anteriores
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-cyan-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Caixa em risco</p>
            <p className="mt-2 text-lg font-black text-slate-900">{formatBRL(data?.summary.openInvoiceAmount || 0)}</p>
            <p className="mt-1 text-sm text-slate-600">
              A fila prioriza cobrança, reativação e revisão operacional antes da receita cair mais.
            </p>
          </div>
        </article>
      </section>

      <section className="surface-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">Ações imediatas</h2>
            <p className="text-sm text-slate-500">Cobrar, suspender, reativar, reenviar link e abrir detalhes</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {data?.alerts.length || 0} itens na fila
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {(data?.alerts ?? []).length > 0 ? (
            data!.alerts.map((alert) => (
              <article key={alert.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{alert.name}</p>
                    <p className="text-xs text-slate-500">/{alert.slug}</p>
                  </div>
                  <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", severityStyles[alert.severity]].join(" ")}>
                    {alert.category === "billing" ? "Cobrança" : alert.category === "financial" ? "Financeiro" : "Operação"}
                  </span>
                </div>

                <p className="mt-3 text-sm font-semibold text-slate-900">{alert.title}</p>
                <p className="mt-1 text-xs text-slate-600">{alert.reason}</p>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500">Valor</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatBRL(alert.amount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Status</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{alert.status || "n/d"}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyReminder(alert)}
                    className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700"
                  >
                    Cobrar
                  </button>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(`${alert.name} · ${alert.reason} · ${alert.action}`)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Reenviar link
                  </button>
                  {alert.status === "suspended" ? (
                    <button
                      type="button"
                      disabled={busyRestaurantId === alert.restaurantId}
                      onClick={() => void updateBillingStatus(alert.restaurantId, "active")}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                    >
                      {busyRestaurantId === alert.restaurantId ? "Reativando..." : "Reativar"}
                    </button>
                  ) : alert.status === "past_due" ? (
                    <button
                      type="button"
                      disabled={busyRestaurantId === alert.restaurantId}
                      onClick={() => void updateBillingStatus(alert.restaurantId, "suspended")}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                    >
                      {busyRestaurantId === alert.restaurantId ? "Suspendendo..." : "Suspender"}
                    </button>
                  ) : null}
                  <Link
                    href={`/platform/admin/restaurants/${alert.restaurantId}`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Abrir detalhes
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 xl:col-span-2">
              Nenhum alerta acionável no momento.
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="surface-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">Linha do tempo</h2>
              <p className="text-sm text-slate-500">Eventos recentes de auditoria e automação</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {(data?.timeline ?? []).length > 0 ? (
              data!.timeline.map((event) => (
                <Link
                  key={event.id}
                  href={event.href || "#"}
                  className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-cyan-200 hover:bg-cyan-50/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{event.title}</p>
                      <p className="text-xs text-slate-500">
                        {event.restaurantName ? `${event.restaurantName} · ` : ""}{event.description}
                      </p>
                    </div>
                    <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", severityStyles[event.severity]].join(" ")}>
                      {event.kind === "audit" ? "Auditoria" : "Automação"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{new Date(event.createdAt).toLocaleString("pt-BR")}</p>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Nenhum evento recente.
              </div>
            )}
          </div>
        </article>

        <article className="surface-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">Top restaurantes</h2>
              <p className="text-sm text-slate-500">Maior volume de pedidos e receita</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {(data?.topRestaurants ?? []).map((restaurant, index) => (
              <Link
                key={restaurant.id}
                href={`/platform/admin/restaurants/${restaurant.id}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-cyan-200 hover:bg-cyan-50/60"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">{index + 1}. {restaurant.name}</p>
                  <p className="text-xs text-slate-500">/{restaurant.slug}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{formatBRL(restaurant.totalRevenue)}</p>
                  <p className="text-xs text-slate-500">{restaurant.totalOrders} pedidos</p>
                </div>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
