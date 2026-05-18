"use client";

import { apiFetch } from "@/services/api";
import { useEffect, useState } from "react";

type PaymentSettingsResponse = {
  openpix: {
    appId: string;
    appIdMasked: string;
    baseUrl: string;
    chargePath: string;
    configured: boolean;
  };
  mercadopago: {
    clientId: string;
    clientIdMasked: string;
    clientSecretMasked: string;
    baseUrl: string;
    configured: boolean;
  };
  updatedAt: string;
};

type GatewayTestResponse = {
  message: string;
  data: {
    openpix?: { ok: boolean; message: string };
    mercadopago?: { ok: boolean; message: string };
  };
};

type TestHistoryEntry = {
  id: string;
  type: "connection_test" | "webhook_simulation";
  gateway: "openpix" | "mercadopago";
  ok: boolean;
  message: string;
  createdAt: string;
  actorEmail?: string;
  metadata?: {
    invoiceId?: string;
    reference?: string;
  };
};

type TestHistoryResponse = {
  data: TestHistoryEntry[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
};

export default function PlatformPaymentsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [openPixConfigured, setOpenPixConfigured] = useState(false);
  const [mercadoPagoConfigured, setMercadoPagoConfigured] = useState(false);
  const [openPixTestStatus, setOpenPixTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [mercadoPagoTestStatus, setMercadoPagoTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [openPixTestMessage, setOpenPixTestMessage] = useState("");
  const [mercadoPagoTestMessage, setMercadoPagoTestMessage] = useState("");
  const [simulationInvoiceId, setSimulationInvoiceId] = useState("");
  const [history, setHistory] = useState<TestHistoryEntry[]>([]);
  const [historyGatewayFilter, setHistoryGatewayFilter] = useState<"" | "openpix" | "mercadopago">("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"" | "connection_test" | "webhook_simulation">("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"" | "ok" | "error">("");
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyCount, setHistoryCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const [openPixAppId, setOpenPixAppId] = useState("");
  const [openPixBaseUrl, setOpenPixBaseUrl] = useState("https://api.openpix.com.br");
  const [openPixChargePath, setOpenPixChargePath] = useState("/api/v1/charge");

  const [mpClientId, setMpClientId] = useState("");
  const [mpClientSecret, setMpClientSecret] = useState("");
  const [mpBaseUrl, setMpBaseUrl] = useState("https://api.mercadopago.com");

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [historyGatewayFilter, historyTypeFilter, historyStatusFilter, historyPage]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyGatewayFilter, historyTypeFilter, historyStatusFilter]);

  async function loadSettings() {
    try {
      setIsLoading(true);
      setError("");
      const data = await apiFetch<PaymentSettingsResponse>("/platform/settings/payment-gateways");

      setOpenPixAppId(data.openpix.appId || "");
      setOpenPixBaseUrl(data.openpix.baseUrl || "https://api.openpix.com.br");
      setOpenPixChargePath(data.openpix.chargePath || "/api/v1/charge");
      setOpenPixConfigured(data.openpix.configured);

      setMpClientId(data.mercadopago.clientId || "");
      setMpBaseUrl(data.mercadopago.baseUrl || "https://api.mercadopago.com");
      setMercadoPagoConfigured(data.mercadopago.configured);
      setUpdatedAt(data.updatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar configurações");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const query = new URLSearchParams();
      if (historyGatewayFilter) query.set("gateway", historyGatewayFilter);
      if (historyTypeFilter) query.set("type", historyTypeFilter);
      if (historyStatusFilter) query.set("status", historyStatusFilter);
      query.set("page", String(historyPage));
      query.set("limit", "10");
      const suffix = query.toString() ? `?${query.toString()}` : "";

      const response = await apiFetch<TestHistoryResponse>(
        `/platform/settings/payment-gateways/test-history${suffix}`
      );
      setHistory(response.data || []);
      setHistoryCount(response.count || 0);
      setHistoryTotalPages(response.totalPages || 1);
    } catch {
      // histórico é complementar e não bloqueia o restante da página
    }
  }

  async function handleExportHistoryCsv() {
    try {
      setIsExporting(true);
      setError("");

      const query = new URLSearchParams();
      if (historyGatewayFilter) query.set("gateway", historyGatewayFilter);
      if (historyTypeFilter) query.set("type", historyTypeFilter);
      if (historyStatusFilter) query.set("status", historyStatusFilter);
      query.set("page", "1");
      query.set("limit", "200");

      const response = await apiFetch<TestHistoryResponse>(
        `/platform/settings/payment-gateways/test-history?${query.toString()}`
      );

      const rows = response.data || [];
      const headers = ["data", "tipo", "gateway", "status", "invoiceId", "ator", "mensagem"];

      const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`;

      const lines = rows.map((entry) => {
        const values = [
          new Date(entry.createdAt).toLocaleString("pt-BR"),
          entry.type === "connection_test" ? "Teste de conexão" : "Simulação webhook",
          entry.gateway,
          entry.ok ? "OK" : "Falha",
          entry.metadata?.invoiceId || "",
          entry.actorEmail || "",
          entry.message,
        ];

        return values.map((v) => escapeCsv(String(v))).join(",");
      });

      const csv = [headers.join(","), ...lines].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payment-test-history-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao exportar histórico");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleClearHistory() {
    try {
      setIsClearingHistory(true);
      setError("");
      setSuccess("");

      const response = await apiFetch<{ message: string }>(
        "/platform/settings/payment-gateways/test-history",
        { method: "DELETE" }
      );

      setSuccess(response.message || "Histórico limpo com sucesso");
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao limpar histórico");
    } finally {
      setIsClearingHistory(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    try {
      setIsSaving(true);
      setError("");
      setSuccess("");

      const response = await apiFetch<{ message: string; updatedAt: string }>(
        "/platform/settings/payment-gateways",
        {
          method: "PUT",
          body: JSON.stringify({
            openpix: {
              appId: openPixAppId,
              baseUrl: openPixBaseUrl,
              chargePath: openPixChargePath,
            },
            mercadopago: {
              clientId: mpClientId,
              clientSecret: mpClientSecret,
              baseUrl: mpBaseUrl,
            },
          }),
        }
      );

      setSuccess(response.message || "Configurações salvas com sucesso");
      setUpdatedAt(response.updatedAt || "");
      setOpenPixConfigured(Boolean(openPixAppId.trim()));
      setMercadoPagoConfigured(Boolean(mpClientId.trim() && (mpClientSecret.trim() || mercadoPagoConfigured)));
      setMpClientSecret("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestGateway(gateway: "openpix" | "mercadopago" | "all") {
    try {
      setIsTesting(true);
      setError("");
      setSuccess("");

      const response = await apiFetch<GatewayTestResponse>("/platform/settings/payment-gateways/test", {
        method: "POST",
        body: JSON.stringify({ gateway }),
      });

      if (response.data.openpix) {
        setOpenPixTestStatus(response.data.openpix.ok ? "ok" : "error");
        setOpenPixTestMessage(response.data.openpix.message);
      }

      if (response.data.mercadopago) {
        setMercadoPagoTestStatus(response.data.mercadopago.ok ? "ok" : "error");
        setMercadoPagoTestMessage(response.data.mercadopago.message);
      }

      setSuccess(response.message);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao testar gateway");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSimulateWebhook(gateway: "openpix" | "mercadopago") {
    try {
      setIsSimulating(true);
      setError("");
      setSuccess("");

      const payload: { gateway: "openpix" | "mercadopago"; invoiceId?: string } = {
        gateway,
      };

      if (simulationInvoiceId.trim()) {
        payload.invoiceId = simulationInvoiceId.trim();
      }

      const response = await apiFetch<{ message: string }>(
        "/platform/settings/payment-gateways/webhooks/simulate",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      setSuccess(response.message || "Webhook simulado com sucesso");
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao simular webhook");
      await loadHistory();
    } finally {
      setIsSimulating(false);
    }
  }

  function statusBadge(configured: boolean, tested: "idle" | "ok" | "error") {
    if (!configured) {
      return <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">Não configurado</span>;
    }

    if (tested === "ok") {
      return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Conexão ok</span>;
    }

    if (tested === "error") {
      return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Falha no teste</span>;
    }

    return <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">Configurado</span>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Configuração de pagamentos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cadastre as credenciais de OpenPix e Mercado Pago para cobrança automática dos restaurantes.
        </p>
        {updatedAt && (
          <p className="mt-2 text-xs text-slate-500">
            Última atualização: {new Date(updatedAt).toLocaleString("pt-BR")}
          </p>
        )}
      </header>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      <form onSubmit={handleSave} className="grid gap-4 lg:grid-cols-2">
        <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">OpenPix (PIX)</h2>
            {statusBadge(openPixConfigured, openPixTestStatus)}
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">App ID</span>
            <input
              value={openPixAppId}
              onChange={(e) => setOpenPixAppId(e.target.value)}
              placeholder="Cole o App ID da OpenPix"
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Base URL</span>
            <input
              value={openPixBaseUrl}
              onChange={(e) => setOpenPixBaseUrl(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Charge Path</span>
            <input
              value={openPixChargePath}
              onChange={(e) => setOpenPixChargePath(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handleTestGateway("openpix")}
              disabled={isTesting}
              className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              Testar OpenPix
            </button>
            {openPixTestMessage && <span className="text-xs text-slate-600">{openPixTestMessage}</span>}
          </div>
        </article>

        <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">Mercado Pago (cartão/Pix)</h2>
            {statusBadge(mercadoPagoConfigured, mercadoPagoTestStatus)}
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Client ID</span>
            <input
              value={mpClientId}
              onChange={(e) => setMpClientId(e.target.value)}
              placeholder="Client ID do Mercado Pago"
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Client Secret</span>
            <input
              type="password"
              value={mpClientSecret}
              onChange={(e) => setMpClientSecret(e.target.value)}
              placeholder="Preencha para atualizar"
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Por segurança, o valor atual não é exibido. Se deixar em branco, mantém o existente.
            </span>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Base URL</span>
            <input
              value={mpBaseUrl}
              onChange={(e) => setMpBaseUrl(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handleTestGateway("mercadopago")}
              disabled={isTesting}
              className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              Testar Mercado Pago
            </button>
            {mercadoPagoTestMessage && <span className="text-xs text-slate-600">{mercadoPagoTestMessage}</span>}
          </div>
        </article>

        <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Salvando..." : "Salvar credenciais"}
          </button>

          <button
            type="button"
            onClick={() => void handleTestGateway("all")}
            disabled={isTesting}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {isTesting ? "Testando..." : "Testar todos os gateways"}
          </button>
        </div>

        <article className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
          <h3 className="text-base font-bold text-slate-900">Simular callback de webhook</h3>
          <p className="text-xs text-slate-600">
            Simula o retorno do gateway e marca a fatura como paga para validar o fluxo interno.
          </p>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Invoice ID (opcional)</span>
            <input
              value={simulationInvoiceId}
              onChange={(e) => setSimulationInvoiceId(e.target.value)}
              placeholder="Se vazio, usa a primeira pendente"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSimulateWebhook("openpix")}
              disabled={isSimulating}
              className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              {isSimulating ? "Simulando..." : "Simular webhook OpenPix"}
            </button>

            <button
              type="button"
              onClick={() => void handleSimulateWebhook("mercadopago")}
              disabled={isSimulating}
              className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              {isSimulating ? "Simulando..." : "Simular webhook Mercado Pago"}
            </button>
          </div>
        </article>
      </form>

      <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Histórico de testes</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => void handleExportHistoryCsv()}
              disabled={isExporting}
              className="rounded-lg border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              {isExporting ? "Exportando..." : "Exportar CSV"}
            </button>
            <button
              type="button"
              onClick={() => void handleClearHistory()}
              disabled={isClearingHistory}
              className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              {isClearingHistory ? "Limpando..." : "Limpar histórico"}
            </button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <select
            value={historyGatewayFilter}
            onChange={(e) => setHistoryGatewayFilter(e.target.value as "" | "openpix" | "mercadopago")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos os gateways</option>
            <option value="openpix">OpenPix</option>
            <option value="mercadopago">Mercado Pago</option>
          </select>

          <select
            value={historyTypeFilter}
            onChange={(e) => setHistoryTypeFilter(e.target.value as "" | "connection_test" | "webhook_simulation")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos os tipos</option>
            <option value="connection_test">Teste de conexão</option>
            <option value="webhook_simulation">Simulação webhook</option>
          </select>

          <select
            value={historyStatusFilter}
            onChange={(e) => setHistoryStatusFilter(e.target.value as "" | "ok" | "error")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos os status</option>
            <option value="ok">OK</option>
            <option value="error">Falha</option>
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{historyCount} registro(s)</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
              disabled={historyPage <= 1}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
            >
              Anterior
            </button>
            <span>
              Página {historyPage} de {historyTotalPages}
            </span>
            <button
              type="button"
              onClick={() => setHistoryPage((prev) => Math.min(historyTotalPages, prev + 1))}
              disabled={historyPage >= historyTotalPages}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Gateway</th>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {new Date(entry.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {entry.type === "connection_test" ? "Teste de conexão" : "Simulação webhook"}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-700">{entry.gateway}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {entry.metadata?.invoiceId || "-"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={[
                        "rounded-full px-2 py-1 text-xs font-semibold",
                        entry.ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
                      ].join(" ")}
                    >
                      {entry.ok ? "OK" : "Falhou"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{entry.message}</td>
                </tr>
              ))}

              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                    Sem histórico até o momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
