import { type OrderStatus } from "@prisma/client";
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { prisma } from "../../prisma/client.js";

type TimeSeriesPoint = {
  date: string;
  revenue: number;
  orders: number;
};

type TopProduct = {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
};

const NON_CANCELLED_STATUSES: OrderStatus[] = ["pending", "preparing", "ready", "delivered"];

function toDateOrNull(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const reportsRoutes = Router();

reportsRoutes.use(authMiddleware);

reportsRoutes.get("/summary", async (req, res) => {
  const { restaurantId } = req.user!;
  const startDateParam = req.query["startDate"];
  const endDateParam = req.query["endDate"];

  const endDate = toDateOrNull(endDateParam) ?? new Date();
  const startDate = toDateOrNull(startDateParam) ?? new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000);

  if (startDate > endDate) {
    return res.status(400).json({ message: "startDate deve ser menor ou igual a endDate" });
  }

  const periodWhere = {
    restaurantId,
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  const [totals, deliveredTotals, statusCountsRaw, periodOrders, orderItems] = await Promise.all([
    prisma.order.aggregate({
      where: {
        ...periodWhere,
        status: { in: NON_CANCELLED_STATUSES },
      },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: {
        ...periodWhere,
        status: "delivered",
      },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: periodWhere,
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: {
        ...periodWhere,
        status: { in: NON_CANCELLED_STATUSES },
      },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          restaurantId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          status: { in: NON_CANCELLED_STATUSES },
        },
      },
      select: {
        productId: true,
        quantity: true,
        price: true,
        product: { select: { name: true } },
      },
    }),
  ]);

  const statusCounts: Record<OrderStatus, number> = {
    pending: 0,
    preparing: 0,
    ready: 0,
    delivered: 0,
    cancelled: 0,
  };

  for (const statusRow of statusCountsRaw) {
    statusCounts[statusRow.status] = statusRow._count._all;
  }

  const dayMap = new Map<string, TimeSeriesPoint>();
  for (const order of periodOrders) {
    const key = toDayKey(order.createdAt);
    const existing = dayMap.get(key);
    if (existing) {
      existing.revenue += order.total;
      existing.orders += 1;
    } else {
      dayMap.set(key, { date: key, revenue: order.total, orders: 1 });
    }
  }

  const series = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const topMap = new Map<string, TopProduct>();
  for (const item of orderItems) {
    const current = topMap.get(item.productId);
    const revenue = item.price * item.quantity;
    if (current) {
      current.quantity += item.quantity;
      current.revenue += revenue;
    } else {
      topMap.set(item.productId, {
        productId: item.productId,
        name: item.product.name,
        quantity: item.quantity,
        revenue,
      });
    }
  }

  const topProducts = Array.from(topMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const totalOrders = totals._count._all;
  const grossRevenue = totals._sum.total ?? 0;
  const deliveredRevenue = deliveredTotals._sum.total ?? 0;
  const averageTicket = totalOrders > 0 ? grossRevenue / totalOrders : 0;

  return res.json({
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    summary: {
      grossRevenue,
      deliveredRevenue,
      totalOrders,
      deliveredOrders: deliveredTotals._count._all,
      averageTicket,
    },
    statusCounts,
    series,
    topProducts,
  });
});
