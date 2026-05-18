"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatBRL } from "../../../../utils/formatBRL";
import { apiFetch } from "@/services/api";

type BillingStatus = "trial" | "active" | "past_due" | "suspended" | "canceled";

type BillingOverviewResponse = {
  summary: {
    totalRestaurants: number;
    withSubscription: number;
    trial: number;
    active: number;
    pastDue: number;
    suspended: number;
    canceled: number;
    pendingInvoices: number;
    overdueInvoices: number;
    outstandingAmount: number;
    mrr: number;
  };
  data: Array<{
    id: string;
    name: string;
    slug: string;
    subscription: {
      id: string;
      planName: string;
      status: BillingStatus;
      interval: "monthly";
      price: number;
      nextBillingAt?: string | null;
      autoRenew: boolean;
    } | null;
    lastInvoice: {
      id: string;
      reference: string;
      amount: number;
      status: "pending" | "paid" | "overdue" | "canceled";
      dueDate: string;
      paidAt?: string | null;
    } | null;
    pendingInvoices: number;
    overdueInvoices: number;
    outstandingAmount: number;
  }>;
  count: number;
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
  nextRunAt?: string | null;
};

type PlatformAnalyticsResponse = {
  health?: {
    restaurantsWithoutOrders30d: number;
    restaurantsWithOpenInvoices: number;
    pastDueSubscriptions: number;
    suspendedSubscriptions: number;
    healthAlerts: Array<{
      id: string;
      name: string;
      slug: string;
      subscriptionStatus: BillingStatus | null;
      orders30d: number;
      revenue30d: number;
      openInvoices: number;
      openAmount: number;
      reasons: string[];
      severity: "high" | "medium" | "low";
    }>;
  };
};

const statusOptions: Array<{ value: "" | BillingStatus; label: string }> = [
  { value: "", label: "Todos" },
  { value: "trial", label: "Trial" },
  { value: "active", label: "Ativos" },
  { value: "past_due", label: "Em atraso" },
  { value: "suspended", label: "Suspensos" },
  { value: "canceled", label: "Cancelados" },
];

const statusLabelMap: Record<BillingStatus, string> = {
  trial: "Trial",
  active: "Ativo",
  past_due: "Em atraso",
  suspended: "Suspenso",
  canceled: "Cancelado",
};

export default function PlatformBillingPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | BillingStatus>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<BillingOverviewResponse | null>(null);
  const [quickStatusByRestaurant, setQuickStatusByRestaurant] = useState<Record<string, BillingStatus>>({});
  const [updatingRestaurantId, setUpdatingRestaurantId] = useState<string | null>(null);
  const [automationHistory, setAutomationHistory] = useState<BillingAutomationHistoryEntry[]>([]);
  const [automationStatus, setAutomationStatus] = useState<BillingAutomationStatusResponse>({
    running: false,
    schedulerEnabled: false,
  });
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [loadingAutomation, setLoadingAutomation] = useState(false);
  const [reprocessingCompetence, setReprocessingCompetence] = useState(false);
  const [healthAlerts, setHealthAlerts] = useState<PlatformAnalyticsResponse["health"]["healthAlerts"]>([]);
  const [competenceReference, setCompetenceReference] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  });

  function maskCompetenceInput(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  useEffect(() => {
    void loadBillingOverview();
    void loadBillingAutomationContext();
  }, [statusFilter]);

  async function loadBillingAutomationContext() {
    try {
      setLoadingAutomation(true);
      const [history, status, analytics] = await Promise.all([
        apiFetch<BillingAutomationHistoryResponse>("/platform/billing/automation/history?limit=10"),
        apiFetch<BillingAutomationStatusResponse>("/platform/billing/automation/status"),
        apiFetch<PlatformAnalyticsResponse>("/platform/analytics"),
      ]);
      setAutomationHistory(history.data);
      setAutomationStatus(status);
      setHealthAlerts((analytics.health?.healthAlerts || []).slice(0, 6));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar automação de billing");
    } finally {
      setLoadingAutomation(false);
    }
  }

  async function loadBillingOverview() {
    try {
      setIsLoading(true);
      setError("");
      const query = new URLSearchParams();
      if (statusFilter) query.set("status", statusFilter);
      if (searchTerm.trim()) query.set("q", searchTerm.trim());
      const suffix = query.toString() ? `?${query.toString()}` : "";

      const data = await apiFetch<BillingOverviewResponse>(`/platform/billing/overview${suffix}`);
      setPayload(data);
      setQuickStatusByRestaurant((prev) => {
        const next = { ...prev };
        for (const row of data.data) {
          if (row.subscription && !next[row.id]) {
            next[row.id] = row.subscription.status;
          }
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar mensalidades");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleQuickStatusUpdate(restaurantId: string) {
    const selectedStatus = quickStatusByRestaurant[restaurantId];
    if (!selectedStatus) return;

    try {
      setUpdatingRestaurantId(restaurantId);
      setError("");
      await apiFetch(`/platform/restaurants/${restaurantId}/billing/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: selectedStatus }),
      });
      await loadBillingOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar status da assinatura");
    } finally {
      setUpdatingRestaurantId(null);
    }
  }

  async function handleRunAutomationNow() {
    try {
      setRunningAutomation(true);
      setError("");
      await apiFetch("/platform/billing/automation/run", { method: "POST" });
      await Promise.all([loadBillingOverview(), loadBillingAutomationContext()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao executar automação");
    } finally {
      setRunningAutomation(false);
    }
  }

  async function handleReprocessCompetence() {
    const reference = competenceReference.trim();
    if (!/^\d{4}-\d{2}$/.test(reference)) {
      setError("Competência inválida. Use o formato AAAA-MM");
      return;
    }

    const month = Number(reference.slice(5, 7));
    if (month < 1 || month > 12) {
      setError("Mês inválido na competência. Use um mês entre 01 e 12");
      return;
    }

    try {
      setReprocessingCompetence(true);
      setError("");
      await apiFetch("/platform/billing/automation/reprocess", {
        method: "POST",
        body: JSON.stringify({ reference }),
      });
      await Promise.all([loadBillingOverview(), loadBillingAutomationContext()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao reprocessar competência");
    } finally {
      setReprocessingCompetence(false);
    }
  }

  const summary = payload?.summary;
  const rows = payload?.data || [];
  const priorityQueue = useMemo(
    () => [...healthAlerts].sort((a, b) => {
      const severityWeight = { high: 0, medium: 1, low: 2 } as const;
      if (severityWeight[a.severity] !== severityWeight[b.severity]) {
        return severityWeight[a.severity] - severityWeight[b.severity];
      }
      return b.openAmount - a.openAmount;
    }),
    [healthAlerts]
  );

  const statusBadgeClass = useMemo(
    () => ({
      trial: "border-amber-200 bg-amber-50 text-amber-700",
      active: "border-emerald-200 bg-emerald-50 text-emerald-700",
      past_due: "border-orange-200 bg-orange-50 text-orange-700",
      suspended: "border-red-200 bg-red-50 text-red-700",
      canceled: "border-slate-200 bg-slate-100 text-slate-700",
    }),
    []
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-cyan-900 to-teal-800 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
              Receita recorrente
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Gestão de mensalidades
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-cyan-100/80 sm:text-base">
              Acompanhe assinaturas, inadimplência e valores em aberto de toda a plataforma.
            </p>
          </div>
          <div className="grid w-full max-w-sm grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-100/80">MRR</p>
              <p className="mt-1 text-xl font-black">
                {formatBRL(summary?.mrr || 0)}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-100/80">Em aberto</p>
              <p className="mt-1 text-xl font-black">
                {formatBRL(summary?.outstandingAmount || 0)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="surface-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">Automação de cobrança</h2>
            <p className="mt-1 text-sm text-slate-500">
              Execute o job manualmente e acompanhe as últimas execuções.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex items-center gap-2">
            <span
              className={[
                "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                automationStatus.schedulerEnabled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-100 text-slate-700",
              ].join(" ")}
            >
              Scheduler {automationStatus.schedulerEnabled ? "ativo" : "inativo"}
            </span>
            <button
              type="button"
              onClick={() => void handleRunAutomationNow()}
              disabled={runningAutomation || automationStatus.running}
              className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:opacity-50"
            >
              {runningAutomation || automationStatus.running ? "Executando..." : "Executar agora"}
            </button>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <input
                value={competenceReference}
                onChange={(e) => setCompetenceReference(maskCompetenceInput(e.target.value))}
                placeholder="AAAA-MM"
                inputMode="numeric"
                maxLength={7}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:w-32"
              />
              <button
                type="button"
                onClick={() => void handleReprocessCompetence()}
                disabled={reprocessingCompetence || automationStatus.running}
                className="rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-50"
              >
                {reprocessingCompetence ? "Reprocessando..." : "Reprocessar"}
              </button>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Próxima execução automática: {automationStatus.nextRunAt
            ? new Date(automationStatus.nextRunAt).toLocaleString("pt-BR")
            : "não agendada"}
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[880px]">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Quando</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Origem</th>
                <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Criadas</th>
                <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Overdue</th>
                <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ativadas</th>
                <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Past due</th>
                <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Duração</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {automationHistory.length > 0 ? (
                automationHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-2 py-2 text-xs text-slate-700">
                      {new Date(entry.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-700">
                      {entry.trigger === "manual" ? "Manual" : "Scheduler"}
                      {entry.actorEmail ? ` · ${entry.actorEmail}` : ""}
                    </td>
                    <td className="px-2 py-2 text-right text-xs font-semibold text-slate-900">{entry.stats.invoicesCreated}</td>
                    <td className="px-2 py-2 text-right text-xs font-semibold text-slate-900">{entry.stats.invoicesMarkedOverdue}</td>
                    <td className="px-2 py-2 text-right text-xs font-semibold text-slate-900">{entry.stats.subscriptionsActivated}</td>
                    <td className="px-2 py-2 text-right text-xs font-semibold text-slate-900">{entry.stats.subscriptionsPastDue}</td>
                    <td className="px-2 py-2 text-right text-xs text-slate-700">{entry.durationMs}ms</td>
                    <td className="px-2 py-2 text-xs">
                      <span
                        className={[
                          "inline-flex rounded-full border px-2 py-0.5 font-semibold",
                          entry.ok
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-red-200 bg-red-50 text-red-700",
                        ].join(" ")}
                      >
                        {entry.ok ? "OK" : "Erro"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-2 py-8 text-center text-sm text-slate-500">
                    {loadingAutomation ? "Carregando histórico..." : "Sem execuções registradas"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card rounded-2xl p-5 sm:p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">Fila prioritária de cobrança</h2>
            <p className="mt-1 text-sm text-slate-500">Restaurantes que precisam de abordagem agora</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {priorityQueue.length} restaurantes
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {priorityQueue.length > 0 ? (
            priorityQueue.map((alert) => (
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

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/platform/admin/restaurants/${alert.id}`}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                  >
                    Abrir restaurante
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      const message = `Olá, ${alert.name}. Identificamos ${alert.reasons.join(", ")}. Pode validar sua cobrança? Valor em aberto: ${formatBRL(alert.openAmount)}.`;
                      await navigator.clipboard.writeText(message);
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Copiar lembrete
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 xl:col-span-2">
              Nenhum alerta prioritário no momento.
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <article className="surface-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lojas</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{summary?.totalRestaurants || 0}</p>
        </article>
        <article className="surface-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ativos</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">{summary?.active || 0}</p>
        </article>
        <article className="surface-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trial</p>
          <p className="mt-2 text-2xl font-black text-amber-700">{summary?.trial || 0}</p>
        </article>
        <article className="surface-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pendentes</p>
          <p className="mt-2 text-2xl font-black text-orange-700">{summary?.pendingInvoices || 0}</p>
        </article>
        <article className="surface-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Atrasadas</p>
          <p className="mt-2 text-2xl font-black text-red-700">{summary?.overdueInvoices || 0}</p>
        </article>
      </section>

      <section className="surface-card rounded-2xl p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar restaurante por nome ou slug"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | BillingStatus)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            {statusOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void loadBillingOverview()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Filtrar
          </button>
        </div>

        <div className="mt-5 space-y-3 lg:hidden">
          {rows.length > 0 ? (
            rows.map((row) => (
              <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900 leading-tight">{row.name}</p>
                    <p className="mt-1 text-xs text-slate-500">/{row.slug}</p>
                  </div>
                  {row.subscription ? (
                    <span
                      className={[
                        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                        statusBadgeClass[row.subscription.status],
                      ].join(" ")}
                    >
                      {statusLabelMap[row.subscription.status]}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      sem assinatura
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="uppercase tracking-wide text-slate-500">Plano</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {row.subscription?.planName || "Sem assinatura"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="uppercase tracking-wide text-slate-500">MRR</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatBRL(row.subscription?.price || 0)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="uppercase tracking-wide text-slate-500">Em aberto</p>
                    <p className="mt-1 text-sm font-semibold text-orange-700">
                      {formatBRL(row.outstandingAmount)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="uppercase tracking-wide text-slate-500">Faturas</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {row.pendingInvoices} pend. / {row.overdueInvoices} atr.
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {row.subscription ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={quickStatusByRestaurant[row.id] || row.subscription.status}
                        onChange={(e) =>
                          setQuickStatusByRestaurant((prev) => ({
                            ...prev,
                            [row.id]: e.target.value as BillingStatus,
                          }))
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="trial">Trial</option>
                        <option value="active">Ativo</option>
                        <option value="past_due">Em atraso</option>
                        <option value="suspended">Suspenso</option>
                        <option value="canceled">Cancelado</option>
                      </select>
                      <button
                        type="button"
                        disabled={updatingRestaurantId === row.id}
                        onClick={() => void handleQuickStatusUpdate(row.id)}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                      >
                        {updatingRestaurantId === row.id ? "..." : "Salvar"}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Sem assinatura</span>
                  )}

                  <Link
                    href={`/platform/admin/restaurants/${row.id}`}
                    className="inline-flex justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                  >
                    Gerenciar
                  </Link>
                </div>

                <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Ver detalhes da última cobrança
                  </summary>

                  {row.lastInvoice ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Referência</p>
                        <p className="mt-0.5 font-medium text-slate-800">{row.lastInvoice.reference}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Vencimento</p>
                        <p className="mt-0.5 font-medium text-slate-800">
                          {new Date(row.lastInvoice.dueDate).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Valor</p>
                        <p className="mt-0.5 font-medium text-slate-800">
                          {formatBRL(row.lastInvoice.amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Status da fatura</p>
                        <p className="mt-0.5 font-medium text-slate-800">{row.lastInvoice.status}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Pago em</p>
                        <p className="mt-0.5 font-medium text-slate-800">
                          {row.lastInvoice.paidAt
                            ? new Date(row.lastInvoice.paidAt).toLocaleDateString("pt-BR")
                            : "Ainda não pago"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">Sem faturas registradas para este restaurante.</p>
                  )}
                </details>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Nenhum restaurante encontrado com os filtros atuais
            </div>
          )}
        </div>

        <div className="mt-5 hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[980px] border-separate border-spacing-0">
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50/80">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Restaurante</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Plano</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">MRR</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Em aberto</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status rápido</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50/90">
                    <td className="px-3 py-3 align-middle">
                      <p className="text-sm font-bold text-slate-900 leading-tight">{row.name}</p>
                      <p className="mt-1 text-xs text-slate-500">/{row.slug}</p>
                    </td>
                    <td className="px-3 py-3 align-middle text-sm text-slate-700">
                      {row.subscription?.planName || "Sem assinatura"}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      {row.subscription ? (
                        <span
                          className={[
                            "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                            statusBadgeClass[row.subscription.status],
                          ].join(" ")}
                        >
                          {statusLabelMap[row.subscription.status]}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          sem assinatura
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle text-right text-sm font-semibold text-slate-900">
                      {formatBRL(row.subscription?.price || 0)}
                    </td>
                    <td className="px-3 py-3 align-middle text-right">
                      <p className="text-sm font-semibold text-orange-700">
                        {formatBRL(row.outstandingAmount)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {row.pendingInvoices} pend. / {row.overdueInvoices} atr.
                      </p>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      {row.subscription ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={quickStatusByRestaurant[row.id] || row.subscription.status}
                            onChange={(e) =>
                              setQuickStatusByRestaurant((prev) => ({
                                ...prev,
                                [row.id]: e.target.value as BillingStatus,
                              }))
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                          >
                            <option value="trial">Trial</option>
                            <option value="active">Ativo</option>
                            <option value="past_due">Em atraso</option>
                            <option value="suspended">Suspenso</option>
                            <option value="canceled">Cancelado</option>
                          </select>
                          <button
                            type="button"
                            disabled={updatingRestaurantId === row.id}
                            onClick={() => void handleQuickStatusUpdate(row.id)}
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                          >
                            {updatingRestaurantId === row.id ? "..." : "Salvar"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Sem assinatura</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle text-right">
                      <Link
                        href={`/platform/admin/restaurants/${row.id}`}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                      >
                        Gerenciar
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-500">
                    Nenhum restaurante encontrado com os filtros atuais
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
