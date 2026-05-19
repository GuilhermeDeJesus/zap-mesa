"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/auth.context";
import { apiFetch } from "../../../services/api";
import type { Table } from "../../../types";

export default function TablesPage() {
  const { restaurant } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [number, setNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<Table[]>("/tables").then((data) => {
      setTables(data);
      setLoading(false);
    });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(number, 10);
    if (!num || num < 1) {
      setError("Informe um número de mesa válido (inteiro positivo)");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const table = await apiFetch<Table>("/tables", {
        method: "POST",
        body: JSON.stringify({ number: num }),
      });
      setTables((prev) => [...prev, table].sort((a, b) => a.number - b.number));
      setNumber("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar mesa");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover mesa?")) return;
    await apiFetch(`/tables/${id}`, { method: "DELETE" });
    setTables((prev) => prev.filter((t) => t.id !== id));
  }

  function fullQrUrl(table: Table) {
    if (typeof window === "undefined") return "";
    if (restaurant?.customDomain) {
      return `https://${restaurant.customDomain}/menu/domain/${table.number}`;
    }
    return `${window.location.origin}${table.qrCode}`;
  }

  async function copyUrl(table: Table) {
    await navigator.clipboard.writeText(fullQrUrl(table));
    setCopied(table.id);
    setTimeout(() => setCopied(null), 2000);
  }

  function escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function printQr(table: Table) {
    if (!table.qrCodeImage) {
      setError("QR code indisponível para impressão nesta mesa");
      return;
    }

    const restaurantName = restaurant?.name ?? "Restaurante";
    const safeRestaurant = escapeHtml(restaurantName);
    const safeUrl = escapeHtml(fullQrUrl(table));
    const safeQr = escapeHtml(table.qrCodeImage);

    const printWindow = window.open("", "_blank", "width=460,height=700");
    if (!printWindow) {
      setError("Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.");
      return;
    }

    printWindow.document.write(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>QR Code Mesa ${table.number}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Tahoma, sans-serif;
        background: #ffffff;
        color: #0f172a;
        padding: 24px;
      }
      .ticket {
        border: 2px solid #f97316;
        border-radius: 18px;
        padding: 18px;
        max-width: 360px;
        margin: 0 auto;
        text-align: center;
      }
      h1 {
        font-size: 20px;
        margin: 0;
      }
      .mesa {
        font-size: 18px;
        font-weight: 800;
        color: #ea580c;
        margin-top: 6px;
      }
      .sub {
        margin-top: 8px;
        color: #475569;
        font-size: 13px;
      }
      img {
        width: 260px;
        height: 260px;
        margin: 16px auto 10px;
        display: block;
      }
      .url {
        margin-top: 6px;
        font-size: 12px;
        color: #64748b;
        word-break: break-all;
      }
      .hint {
        margin-top: 12px;
        font-size: 12px;
        color: #334155;
      }
      @media print {
        body { padding: 0; }
        .ticket {
          border-color: #000;
          border-radius: 0;
          max-width: none;
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <div class="ticket">
      <h1>${safeRestaurant}</h1>
      <div class="mesa">Mesa ${table.number}</div>
      <p class="sub">Escaneie para abrir o cardápio</p>
      <img src="${safeQr}" alt="QR code da mesa ${table.number}" />
      <div class="url">${safeUrl}</div>
      <p class="hint">Zap Mesa</p>
    </div>
    <script>
      window.addEventListener("load", () => {
        window.print();
      });
    </script>
  </body>
</html>`);
    printWindow.document.close();
  }

  if (loading) return <p className="text-gray-500">Carregando...</p>;

  return (
    <div className="max-w-4xl space-y-6">
      <section className="rounded-3xl bg-white/90 backdrop-blur border border-white/70 shadow-sm p-6 md:p-7">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500 font-semibold">QR code por mesa</p>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 mt-1">Mesas</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Crie mesas com links rápidos para o cardápio público do restaurante {restaurant?.slug}.
        </p>
      </section>

      <form
        onSubmit={(e) => { void handleCreate(e); }}
        className="bg-white/90 backdrop-blur rounded-3xl border border-white/70 p-5 md:p-6 flex flex-col sm:flex-row gap-3 items-end shadow-sm"
      >
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Número da mesa
          </label>
          <input
            type="number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="Ex: 1"
            min="1"
            required
            className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="bg-orange-500 text-white text-sm px-5 py-3 rounded-2xl hover:bg-orange-600 disabled:opacity-50 transition shadow-sm"
        >
          {submitting ? "..." : "+ Criar mesa"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">{error}</p>}

      <div className="bg-white/90 backdrop-blur rounded-3xl border border-white/70 divide-y divide-slate-100 overflow-hidden shadow-sm">
        {tables.length === 0 && (
          <p className="text-center py-10 text-slate-400 text-sm">Nenhuma mesa cadastrada</p>
        )}
        {tables.map((t) => (
          <div key={t.id} className="px-5 py-4 hover:bg-slate-50/80 transition">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-slate-800">Mesa {t.number}</p>
              <button
                onClick={() => { void handleDelete(t.id); }}
                className="text-xs text-red-500 hover:text-red-600 font-medium"
              >
                Excluir
              </button>
            </div>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="h-28 w-28 rounded-2xl border border-slate-200 bg-white p-2 flex items-center justify-center">
                {t.qrCodeImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.qrCodeImage} alt={`QR code da mesa ${t.number}`} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[11px] text-slate-400 text-center">QR indisponivel</span>
                )}
              </div>

              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <code className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-slate-500 truncate">
                  {fullQrUrl(t)}
                </code>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { void copyUrl(t); }}
                    className="text-xs text-orange-600 hover:text-orange-700 whitespace-nowrap font-medium"
                  >
                    {copied === t.id ? "Copiado ✓" : "Copiar link"}
                  </button>
                  <button
                    onClick={() => printQr(t)}
                    className="text-xs text-slate-600 hover:text-slate-800 whitespace-nowrap font-medium"
                  >
                    Imprimir QR
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
