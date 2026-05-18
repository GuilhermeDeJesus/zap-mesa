"use client";

import { useEffect, useMemo, useState } from "react";
import { formatBRL } from "../../../../utils/formatBRL";
import { apiFetch } from "@/services/api";

type InvoiceStatus = "pending" | "paid" | "overdue" | "canceled";

type BillingResponse = {
  subscription: {
    id: string;
    planName: string;
    status: "trial" | "active" | "past_due" | "suspended" | "canceled";
    interval: "monthly";
    price: number;
    nextBillingAt?: string | null;
    autoRenew: boolean;
  } | null;
  invoices: Array<{
    id: string;
    reference: string;
    amount: number;
    status: InvoiceStatus;
    dueDate: string;
    paidAt?: string | null;
    method?: string | null;
  }>;
};

type PixIntentResponse = {
  invoiceId: string;
  amount: number;
  qrCodeImage: string | null;
  brCode: string | null;
  paymentLinkUrl: string | null;
  providerChargeId: string | null;
};

type CardIntentResponse = {
  invoiceId: string;
  checkoutUrl: string;
  providerReference: string | null;
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
  canceled: "Cancelado",
};

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue: "bg-rose-50 text-rose-700 border-rose-200",
  canceled: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function RestaurantBillingPage() {
  const [payload, setPayload] = useState<BillingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [pixPayload, setPixPayload] = useState<PixIntentResponse | null>(null);

  useEffect(() => {
    void loadBilling();
  }, []);

  async function loadBilling() {
    try {
      setIsLoading(true);
      setError("");
      const data = await apiFetch<BillingResponse>("/restaurant/billing");
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar cobranças");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreatePix(invoiceId: string) {
    try {
      setPayingInvoiceId(invoiceId);
      setError("");
      const data = await apiFetch<PixIntentResponse>(
        `/restaurant/billing/invoices/${invoiceId}/payment-intents/pix`,
        {
          method: "POST",
        }
      );
      setPixPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar PIX");
    } finally {
      setPayingInvoiceId(null);
    }
  }

  async function handleCreateCardCheckout(invoiceId: string) {
    try {
      setPayingInvoiceId(invoiceId);
      setError("");
      const data = await apiFetch<CardIntentResponse>(
        `/restaurant/billing/invoices/${invoiceId}/payment-intents/card`,
        {
          method: "POST",
        }
      );

      window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar pagamento com cartão");
    } finally {
      setPayingInvoiceId(null);
    }
  }

  async function handleConfirmManual(invoiceId: string) {
    try {
      setPayingInvoiceId(invoiceId);
      setError("");
      await apiFetch(`/restaurant/billing/invoices/${invoiceId}/pay`, {
        method: "PATCH",
        body: JSON.stringify({ method: "manual" }),
      });
      await loadBilling();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar pagamento");
    } finally {
      setPayingInvoiceId(null);
    }
  }

  async function handleDeleteInvoice(invoiceId: string) {
    const confirmed = window.confirm("Tem certeza que deseja excluir esta fatura? Essa ação não pode ser desfeita.");
    if (!confirmed) return;

    try {
      setPayingInvoiceId(invoiceId);
      setError("");
      await apiFetch(`/restaurant/billing/invoices/${invoiceId}`, {
        method: "DELETE",
      });
      await loadBilling();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir fatura");
    } finally {
      setPayingInvoiceId(null);
    }
  }

  const summary = useMemo(() => {
    const invoices = payload?.invoices ?? [];
    return invoices.reduce(
      (acc, invoice) => {
        if (invoice.status === "pending") acc.pending += 1;
        if (invoice.status === "overdue") acc.overdue += 1;
        if (invoice.status === "pending" || invoice.status === "overdue") {
          acc.outstanding += invoice.amount;
        }
        return acc;
      },
      { pending: 0, overdue: 0, outstanding: 0 }
    );
  }, [payload]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Billing do Restaurante</h1>
        <p className="text-sm text-slate-600">
          Veja suas faturas, acompanhe vencimentos e registre pagamentos.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pendentes</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.pending}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Atrasadas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.overdue}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Em aberto</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatBRL(summary.outstanding)}
          </p>
        </article>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-bold text-slate-900">Plano atual</h2>
        <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <p>
            Plano: <strong>{payload?.subscription?.planName ?? "Sem assinatura"}</strong>
          </p>
          <p>
            Valor: <strong>{formatBRL(payload?.subscription?.price ?? 0)}</strong>
          </p>
        </div>
      </article>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Referência</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.invoices ?? []).map((invoice) => {
                const canPay = invoice.status === "pending" || invoice.status === "overdue";

                return (
                  <tr key={invoice.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{invoice.reference}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(invoice.dueDate).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {invoice.amount.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[invoice.status]}`}>
                        {STATUS_LABEL[invoice.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canPay ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleCreatePix(invoice.id)}
                            disabled={payingInvoiceId === invoice.id}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {payingInvoiceId === invoice.id ? "Processando..." : "Gerar Pix"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCreateCardCheckout(invoice.id)}
                            disabled={payingInvoiceId === invoice.id}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                          >
                            Cartão / MP
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmManual(invoice.id)}
                            disabled={payingInvoiceId === invoice.id}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            Confirmar manual
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(invoice.id)}
                            disabled={payingInvoiceId === invoice.id}
                            className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            Excluir
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Sem ação</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {(payload?.invoices ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Nenhuma fatura encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {pixPayload && (
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-emerald-900">Pix gerado</h3>
              <p className="mt-1 text-sm text-emerald-800">
                Escaneie o QR Code ou copie o código Pix para pagar a fatura.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPixPayload(null)}
              className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              Fechar
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="flex items-center justify-center rounded-xl border border-emerald-200 bg-white p-3">
              {pixPayload.qrCodeImage ? (
                <img src={pixPayload.qrCodeImage} alt="QR Code Pix" className="h-48 w-48 object-contain" />
              ) : (
                <p className="text-center text-xs text-slate-500">QR Code indisponível no retorno da OpenPix.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Código Pix (BR Code)</p>
              <textarea
                readOnly
                value={pixPayload.brCode ?? ""}
                className="h-28 w-full rounded-xl border border-emerald-200 bg-white p-3 text-xs text-slate-700"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!pixPayload.brCode) return;
                    await navigator.clipboard.writeText(pixPayload.brCode);
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Copiar código Pix
                </button>
                {pixPayload.paymentLinkUrl && (
                  <a
                    href={pixPayload.paymentLinkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    Abrir link de pagamento
                  </a>
                )}
              </div>
            </div>
          </div>
        </article>
      )}
    </section>
  );
}
