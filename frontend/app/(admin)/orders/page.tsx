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
          <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
        ))}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  onStatusChange,
}: {
  order: Order;
  onStatusChange: (id: string, status: OrderStatus) => Promise<void>;
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

      <div className="px-4 py-3 border-t flex items-center justify-between bg-slate-50/70">
        <span className="text-sm font-semibold text-slate-700">
          Total: {formatBRL(order.total)}
        </span>
        <span className="text-xs text-slate-400">
          #{order.id.slice(-6).toUpperCase()}
        </span>
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
