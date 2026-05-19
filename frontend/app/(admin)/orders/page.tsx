"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../../../contexts/auth.context";
import { apiFetch } from "../../../services/api";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  type Order,
  type OrderStatus,
} from "../../../types";
import { formatBRL } from "../../../utils/formatBRL";

const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivered"],
  delivered: [],
  cancelled: [],
};

export default function OrdersPage() {
  const { restaurant, token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const socketRef = useRef<Socket | null>(null);

  const loadOrders = useCallback(async () => {
    const data = await apiFetch<Order[]>("/orders");
    setOrders(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!restaurant?.id || !token) return;

    const rawApiUrl = process.env.NEXT_PUBLIC_API_URL;
    const socketBaseUrl =
      rawApiUrl && !rawApiUrl.startsWith("/")
        ? rawApiUrl
        : typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost:3333";

    const socket = io(socketBaseUrl, {
      auth: { token },
      path: "/socket.io",
    });
    socketRef.current = socket;

    socket.emit("join-restaurant", restaurant.id);

    socket.on("new-order", (order: Order) => {
      setOrders((prev) => [order, ...prev]);
    });

    socket.on("order-updated", (updated: Order) => {
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    });

    return () => {
      socket.disconnect();
    };
  }, [restaurant?.id, token]);

  async function handleStatusChange(orderId: string, nextStatus: OrderStatus) {
    await apiFetch(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    // the socket event will update UI; do a pessimistic local update too
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );
  }

  const STATUS_FILTERS: Array<OrderStatus | "all"> = [
    "all",
    "pending",
    "preparing",
    "ready",
    "delivered",
    "cancelled",
  ];

  const visible = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  if (loading) return <p className="text-gray-500">Carregando...</p>;

  return (
    <div className="max-w-7xl space-y-6">
      <section className="rounded-3xl bg-white/90 backdrop-blur border border-white/70 shadow-sm p-6 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-orange-500 font-semibold">Cozinha</p>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 mt-1">Painel de Pedidos</h1>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl">
              Visual simples para acompanhar o fluxo em tempo real do restaurante {restaurant?.name}.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Socket ativo
            </span>
            <span className="rounded-full bg-slate-50 px-3 py-1.5">
              {visible.length} pedido(s) exibido(s)
            </span>
          </div>
        </div>
      </section>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-4 py-2 rounded-full font-medium transition border ${
              filter === s
                ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {s === "all" ? "Todos" : ORDER_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="text-center py-16 text-slate-400 bg-white/80 border border-white/70 rounded-3xl">
          Nenhum pedido encontrado
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onStatusChange={handleStatusChange}
            restaurantName={restaurant?.name}
          />
        ))}
      </div>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function OrderCard({
  order,
  onStatusChange,
  restaurantName,
}: {
  order: Order;
  onStatusChange: (id: string, status: OrderStatus) => Promise<void>;
  restaurantName?: string;
}) {
  const [updating, setUpdating] = useState(false);
  const nextStatuses = NEXT_STATUS[order.status];

  async function handleClick(status: OrderStatus) {
    setUpdating(true);
    try {
      await onStatusChange(order.id, status);
    } finally {
      setUpdating(false);
    }
  }

  function printOrder() {
    const safeRestaurant = escapeHtml(restaurantName || "Restaurante");
    const createdAt = new Date(order.createdAt);
    const createdLabel = Number.isNaN(createdAt.getTime())
      ? ""
      : createdAt.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
    const safeCreatedLabel = escapeHtml(createdLabel);

    const itemsHtml = order.items
      .map((item) => {
        const name = escapeHtml(item.product?.name ?? "Produto removido");
        const qty = item.quantity;
        const subtotal = escapeHtml(formatBRL(item.price * item.quantity));
        const notes = item.notes?.trim()
          ? `<div class="notes">Obs: ${escapeHtml(item.notes)}</div>`
          : "";

        return `<div class="item-row">
          <div>
            <div class="item-name">${qty}x ${name}</div>
            ${notes}
          </div>
          <div class="item-price">${subtotal}</div>
        </div>`;
      })
      .join("");

    const printWindow = window.open("", "_blank", "width=420,height=720");
    if (!printWindow) return;

    printWindow.document.write(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Pedido ${escapeHtml(order.id.slice(-6).toUpperCase())}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 16px;
        background: #fff;
        color: #0f172a;
        font-family: "Courier New", monospace;
      }
      .ticket {
        width: 100%;
        max-width: 360px;
        margin: 0 auto;
        border: 1px dashed #334155;
        padding: 12px;
      }
      .restaurant {
        text-align: center;
        font-size: 16px;
        font-weight: 700;
      }
      .meta {
        margin-top: 8px;
        font-size: 12px;
        color: #334155;
      }
      .meta-line {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .divider {
        border-top: 1px dashed #64748b;
        margin: 10px 0;
      }
      .item-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 8px;
      }
      .item-name {
        font-size: 13px;
        font-weight: 700;
      }
      .notes {
        margin-top: 2px;
        font-size: 11px;
        color: #334155;
      }
      .item-price {
        font-size: 13px;
        white-space: nowrap;
      }
      .total {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        font-weight: 700;
      }
      .kitchen {
        margin-top: 10px;
        text-align: center;
        font-size: 12px;
      }
      @media print {
        body { padding: 0; }
        .ticket {
          max-width: none;
          width: 100%;
          border: 1px dashed #000;
        }
      }
    </style>
  </head>
  <body>
    <div class="ticket">
      <div class="restaurant">${safeRestaurant}</div>
      <div class="meta">
        <div class="meta-line"><span>Pedido</span><span>#${escapeHtml(order.id.slice(-6).toUpperCase())}</span></div>
        <div class="meta-line"><span>Mesa</span><span>${escapeHtml(String(order.table?.number ?? "-"))}</span></div>
        <div class="meta-line"><span>Status</span><span>${escapeHtml(ORDER_STATUS_LABEL[order.status])}</span></div>
        ${safeCreatedLabel ? `<div class="meta-line"><span>Hora</span><span>${safeCreatedLabel}</span></div>` : ""}
      </div>
      <div class="divider"></div>
      ${itemsHtml}
      <div class="divider"></div>
      <div class="total"><span>Total</span><span>${escapeHtml(formatBRL(order.total))}</span></div>
      <div class="kitchen">Comanda para a cozinha</div>
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

  return (
    <div className="bg-white rounded-3xl border border-white/70 shadow-sm overflow-hidden">
      <div className={`px-4 py-3 text-xs font-semibold flex items-center justify-between ${ORDER_STATUS_COLOR[order.status]}`}>
        <span>Mesa {order.table?.number ?? "—"}</span>
        <span>{ORDER_STATUS_LABEL[order.status]}</span>
      </div>

      <div className="px-4 py-4 space-y-3">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-3 text-sm text-slate-700">
            <div className="min-w-0">
              <p className="font-medium text-slate-800">
                {item.quantity}× {item.product?.name ?? "Produto removido"}
              </p>
              {item.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{item.notes}</p>}
            </div>
            <span className="text-slate-500 whitespace-nowrap">
              {formatBRL(item.price * item.quantity)}
            </span>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t flex items-center justify-between bg-slate-50/70 gap-2">
        <span className="text-sm font-semibold text-slate-700">
          Total: {formatBRL(order.total)}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={printOrder}
            className="text-xs text-slate-600 hover:text-slate-800 font-medium"
          >
            Imprimir pedido
          </button>
          <span className="text-xs text-slate-400">
            #{order.id.slice(-6).toUpperCase()}
          </span>
        </div>
      </div>

      {nextStatuses.length > 0 && (
        <div className="px-4 py-3 border-t flex gap-2 flex-wrap bg-white">
          {nextStatuses.map((s) => (
            <button
              key={s}
              disabled={updating}
              onClick={() => { void handleClick(s); }}
              className={`flex-1 text-xs py-2 rounded-xl font-medium transition disabled:opacity-50 ${
                s === "cancelled"
                  ? "border border-red-300 text-red-600 hover:bg-red-50 bg-white"
                  : "bg-orange-500 text-white hover:bg-orange-600 shadow-sm"
              }`}
            >
              {ORDER_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
