import { Router } from "express";
import { InvoiceStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../prisma/client.js";
import { platformAuthMiddleware } from "../../middlewares/platform-auth.middleware.js";
import {
  maskSecret,
  readPaymentGatewayConfig,
  writePaymentGatewayConfig,
} from "../../utils/payment-config-store.js";
import {
  testMercadoPagoConnection,
  testOpenPixConnection,
} from "../../utils/payment-gateways.js";
import {
  appendPaymentTestHistory,
  clearPaymentTestHistory,
  readPaymentTestHistory,
  type PaymentGatewayName,
} from "../../utils/payment-test-history-store.js";
import {
  getBillingAutomationStatus,
  reprocessBillingCompetence,
  readBillingAutomationHistory,
  runBillingAutomation,
} from "../../utils/billing-automation.js";

export const platformRoutes = Router();
const MANAGEABLE_RESTAURANT_ROLES = ["RESTAURANT_ADMIN", "RESTAURANT_STAFF"] as const;

function getPlatformActor(req: unknown): { userId?: string; email?: string } {
  const user = (req as { user?: { userId?: string; email?: string } }).user;
  return { userId: user?.userId, email: user?.email };
}

async function createAuditLog(params: {
  restaurantId: string;
  req: unknown;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const actor = getPlatformActor(params.req);

  await prisma.auditLog.create({
    data: {
      restaurantId: params.restaurantId,
      actorId: actor.userId,
      actorEmail: actor.email,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata,
    },
  });
}

async function reconcileSubscriptionAfterInvoiceChange(restaurantId: string) {
  const pendingOrOverdue = await prisma.invoice.count({
    where: {
      restaurantId,
      status: { in: ["pending", "overdue"] },
    },
  });

  if (pendingOrOverdue === 0) {
    await prisma.subscription.updateMany({
      where: { restaurantId },
      data: { status: "active" },
    });
  }
}

function toDateOrNull(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetween(startDate: Date, endDate: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// Middleware que protege todas as rotas de plataforma
platformRoutes.use(platformAuthMiddleware);

// GET /platform/restaurants - Listar todos os restaurantes
platformRoutes.get("/restaurants", async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true },
        },
        _count: {
          select: { orders: true, products: true, tables: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const restaurantsWithStats = await Promise.all(
      restaurants.map(async (restaurant) => {
        const totalRevenue = await prisma.order.aggregate({
          where: {
            restaurantId: restaurant.id,
            status: "delivered",
          },
          _sum: { total: true },
        });

        return {
          ...restaurant,
          totalRevenue: totalRevenue._sum.total || 0,
        };
      })
    );

    return res.json({
      data: restaurantsWithStats,
      count: restaurantsWithStats.length,
    });
  } catch (error) {
    console.error("Erro ao listar restaurantes:", error);
    return res.status(500).json({ message: "Erro ao listar restaurantes" });
  }
});

// GET /platform/restaurants/:id - Detalhes de um restaurante
platformRoutes.get("/restaurants/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true, createdAt: true },
        },
        subscription: true,
        _count: {
          select: { orders: true, products: true, tables: true, categories: true },
        },
      },
    });

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurante não encontrado" });
    }

    const totalRevenue = await prisma.order.aggregate({
      where: {
        restaurantId: id,
        status: "delivered",
      },
      _sum: { total: true },
    });

    return res.json({
      ...restaurant,
      totalRevenue: totalRevenue._sum.total || 0,
    });
  } catch (error) {
    console.error("Erro ao buscar restaurante:", error);
    return res.status(500).json({ message: "Erro ao buscar restaurante" });
  }
});

// POST /platform/restaurants - Criar novo restaurante
platformRoutes.post("/restaurants", async (req, res) => {
  const { name, slug, phone } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ message: "name e slug são obrigatórios" });
  }

  try {
    const existingSlug = await prisma.restaurant.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      return res.status(409).json({ message: "Slug já em uso" });
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        slug,
        phone: phone || null,
      },
      include: {
        users: true,
        _count: {
          select: { orders: true, products: true, tables: true, categories: true },
        },
      },
    });

    return res.status(201).json({
      message: "Restaurante criado com sucesso",
      data: restaurant,
    });
  } catch (error) {
    console.error("Erro ao criar restaurante:", error);
    return res.status(500).json({ message: "Erro ao criar restaurante" });
  }
});

// PUT /platform/restaurants/:id - Atualizar restaurante
platformRoutes.put("/restaurants/:id", async (req, res) => {
  const { id } = req.params;
  const { name, slug, phone, logoUrl, customDomain } = req.body;

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
    });

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurante não encontrado" });
    }

    // Validar slug uniqueness se estiver sendo alterado
    if (slug && slug !== restaurant.slug) {
      const existingSlug = await prisma.restaurant.findUnique({
        where: { slug },
      });

      if (existingSlug) {
        return res.status(409).json({ message: "Slug já em uso" });
      }
    }

    // Validar custom domain uniqueness se estiver sendo alterado
    if (customDomain && customDomain !== restaurant.customDomain) {
      const existingDomain = await prisma.restaurant.findUnique({
        where: { customDomain },
      });

      if (existingDomain) {
        return res.status(409).json({ message: "Domínio customizado já em uso" });
      }
    }

    const updated = await prisma.restaurant.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(phone !== undefined && { phone }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(customDomain !== undefined && { customDomain }),
      },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true },
        },
        _count: {
          select: { orders: true, products: true, tables: true, categories: true },
        },
      },
    });

    return res.json({
      message: "Restaurante atualizado com sucesso",
      data: updated,
    });
  } catch (error) {
    console.error("Erro ao atualizar restaurante:", error);
    return res.status(500).json({ message: "Erro ao atualizar restaurante" });
  }
});

// DELETE /platform/restaurants/:id - Deletar restaurante
platformRoutes.delete("/restaurants/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
    });

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurante não encontrado" });
    }

    await prisma.restaurant.delete({
      where: { id },
    });

    return res.json({
      message: "Restaurante deletado com sucesso",
    });
  } catch (error) {
    console.error("Erro ao deletar restaurante:", error);
    return res.status(500).json({ message: "Erro ao deletar restaurante" });
  }
});

// GET /platform/restaurants/:id/users - Listar usuários de um restaurante
platformRoutes.get("/restaurants/:id/users", async (req, res) => {
  const { id } = req.params;
  const { page = "1", limit = "10", q = "", role = "" } = req.query;
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const searchTerm = String(q).trim();
  const roleFilter = String(role).trim();

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
    });

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurante não encontrado" });
    }

    const where = {
      restaurantId: id,
      ...(searchTerm
        ? {
            OR: [
              { name: { contains: searchTerm, mode: "insensitive" as const } },
              { email: { contains: searchTerm, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(roleFilter ? { role: roleFilter as "RESTAURANT_ADMIN" | "RESTAURANT_STAFF" } : {}),
    };

    const [users, count] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({
      data: users,
      count,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(count / pageSize),
    });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    return res.status(500).json({ message: "Erro ao listar usuários" });
  }
});

// POST /platform/restaurants/:id/users - Criar usuário para restaurante
platformRoutes.post("/restaurants/:id/users", async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email e password são obrigatórios" });
  }

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
    });

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurante não encontrado" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ message: "Email já cadastrado" });
    }

    const bcrypt = await import("bcrypt").then((m) => m.default);
    const hashedPassword = await bcrypt.hash(password, 10);
    const normalizedRole = role || "RESTAURANT_STAFF";

    if (!MANAGEABLE_RESTAURANT_ROLES.includes(normalizedRole)) {
      return res.status(400).json({
        message: "role inválido. Use RESTAURANT_ADMIN ou RESTAURANT_STAFF",
      });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: normalizedRole,
        restaurantId: id,
      },
    });

    await createAuditLog({
      restaurantId: id,
      req,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      metadata: { name, email, role: normalizedRole },
    });

    return res.status(201).json({
      message: "Usuário criado com sucesso",
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    return res.status(500).json({ message: "Erro ao criar usuário" });
  }
});

// PUT /platform/restaurants/:id/users/:userId - Atualizar usuário de restaurante
platformRoutes.put("/restaurants/:id/users/:userId", async (req, res) => {
  const { id, userId } = req.params;
  const { name, email, role, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.restaurantId !== id) {
      return res.status(404).json({ message: "Usuário não encontrado neste restaurante" });
    }

    if (role && !MANAGEABLE_RESTAURANT_ROLES.includes(role)) {
      return res.status(400).json({
        message: "role inválido. Use RESTAURANT_ADMIN ou RESTAURANT_STAFF",
      });
    }

    if (email && email !== user.email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser && existingUser.id !== userId) {
        return res.status(409).json({ message: "Email já cadastrado" });
      }
    }

    const data: {
      name?: string;
      email?: string;
      role?: "RESTAURANT_ADMIN" | "RESTAURANT_STAFF";
      password?: string;
    } = {};

    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;

    if (password) {
      const bcrypt = await import("bcrypt").then((m) => m.default);
      data.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    await createAuditLog({
      restaurantId: id,
      req,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: userId,
      metadata: {
        name,
        email,
        role,
        passwordChanged: Boolean(password),
      },
    });

    return res.json({
      message: "Usuário atualizado com sucesso",
      data: updated,
    });
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    return res.status(500).json({ message: "Erro ao atualizar usuário" });
  }
});

// DELETE /platform/restaurants/:id/users/:userId - Deletar usuário de restaurante
platformRoutes.delete("/restaurants/:id/users/:userId", async (req, res) => {
  const { id, userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.restaurantId !== id) {
      return res.status(404).json({ message: "Usuário não encontrado neste restaurante" });
    }

    if (user.role === "RESTAURANT_ADMIN") {
      const adminCount = await prisma.user.count({
        where: {
          restaurantId: id,
          role: "RESTAURANT_ADMIN",
        },
      });

      if (adminCount <= 1) {
        return res.status(400).json({
          message: "Não é possível remover o último administrador do restaurante",
        });
      }
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    await createAuditLog({
      restaurantId: id,
      req,
      action: "USER_DELETED",
      entityType: "User",
      entityId: userId,
      metadata: { role: user.role, email: user.email },
    });

    return res.json({
      message: "Usuário removido com sucesso",
    });
  } catch (error) {
    console.error("Erro ao remover usuário:", error);
    return res.status(500).json({ message: "Erro ao remover usuário" });
  }
});

// GET /platform/analytics - Métricas globais da plataforma
platformRoutes.get("/analytics", async (req, res) => {
  try {
    const last30Days = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const totalRestaurants = await prisma.restaurant.count();

    const totalOrders = await prisma.order.count();

    const totalRevenue = await prisma.order.aggregate({
      where: { status: "delivered" },
      _sum: { total: true },
    });

    const totalUsers = await prisma.user.count();

    const [restaurants, deliveredOrders30d, openInvoiceGroups, topRestaurants] = await Promise.all([
      prisma.restaurant.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          subscription: {
            select: { status: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.groupBy({
        by: ["restaurantId"],
        where: {
          createdAt: { gte: last30Days },
          status: "delivered",
        },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.invoice.groupBy({
        by: ["restaurantId"],
        where: {
          status: { in: ["pending", "overdue"] },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.restaurant.findMany({
        include: {
          _count: {
            select: { orders: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    const deliveredOrdersMap = new Map<string, { orders30d: number; revenue30d: number }>();
    for (const row of deliveredOrders30d) {
      deliveredOrdersMap.set(row.restaurantId, {
        orders30d: row._count._all,
        revenue30d: row._sum.total || 0,
      });
    }

    const openInvoicesMap = new Map<string, { openInvoices: number; openAmount: number }>();
    for (const row of openInvoiceGroups) {
      openInvoicesMap.set(row.restaurantId, {
        openInvoices: row._count._all,
        openAmount: row._sum.amount || 0,
      });
    }

    const healthAlerts = restaurants
      .map((restaurant) => {
        const deliveryStats = deliveredOrdersMap.get(restaurant.id) || { orders30d: 0, revenue30d: 0 };
        const invoiceStats = openInvoicesMap.get(restaurant.id) || { openInvoices: 0, openAmount: 0 };
        const reasons: string[] = [];

        if (deliveryStats.orders30d === 0) reasons.push("sem pedidos nos últimos 30 dias");
        if (invoiceStats.openInvoices > 0) reasons.push(`${invoiceStats.openInvoices} fatura(s) em aberto`);
        if (restaurant.subscription?.status === "past_due") reasons.push("assinatura em atraso");
        if (restaurant.subscription?.status === "suspended") reasons.push("assinatura suspensa");

        return {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          subscriptionStatus: restaurant.subscription?.status || null,
          orders30d: deliveryStats.orders30d,
          revenue30d: deliveryStats.revenue30d,
          openInvoices: invoiceStats.openInvoices,
          openAmount: invoiceStats.openAmount,
          reasons,
          severity:
            restaurant.subscription?.status === "suspended" || restaurant.subscription?.status === "past_due"
              ? "high"
              : reasons.length > 0
                ? "medium"
                : "low",
        };
      })
      .filter((restaurant) => restaurant.reasons.length > 0)
      .sort((a, b) => {
        const severityWeight = { high: 0, medium: 1, low: 2 } as const;
        if (severityWeight[a.severity as keyof typeof severityWeight] !== severityWeight[b.severity as keyof typeof severityWeight]) {
          return severityWeight[a.severity as keyof typeof severityWeight] - severityWeight[b.severity as keyof typeof severityWeight];
        }
        return b.openAmount - a.openAmount;
      })
      .slice(0, 6);

    const restaurantsWithoutOrders30d = restaurants.filter((restaurant) => {
      const deliveryStats = deliveredOrdersMap.get(restaurant.id) || { orders30d: 0, revenue30d: 0 };
      return deliveryStats.orders30d === 0;
    }).length;

    const restaurantsWithOpenInvoices = restaurants.filter((restaurant) => {
      const invoiceStats = openInvoicesMap.get(restaurant.id) || { openInvoices: 0, openAmount: 0 };
      return invoiceStats.openInvoices > 0;
    }).length;

    const topRestaurantsWithRevenue = await Promise.all(
      topRestaurants.map(async (restaurant) => {
        const revenue = await prisma.order.aggregate({
          where: {
            restaurantId: restaurant.id,
            status: "delivered",
          },
          _sum: { total: true },
        });

        return {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          totalOrders: restaurant._count.orders,
          totalRevenue: revenue._sum.total || 0,
        };
      })
    );

    return res.json({
      summary: {
        totalRestaurants,
        totalOrders,
        totalRevenue: totalRevenue._sum.total || 0,
        totalUsers,
      },
      health: {
        restaurantsWithoutOrders30d,
        restaurantsWithOpenInvoices,
        pastDueSubscriptions: restaurants.filter((restaurant) => restaurant.subscription?.status === "past_due").length,
        suspendedSubscriptions: restaurants.filter((restaurant) => restaurant.subscription?.status === "suspended").length,
        healthAlerts,
      },
      topRestaurants: topRestaurantsWithRevenue,
    });
  } catch (error) {
    console.error("Erro ao buscar analytics:", error);
    return res.status(500).json({ message: "Erro ao buscar analytics" });
  }
});

// GET /platform/reports/financial - relatório financeiro consolidado da plataforma
platformRoutes.get("/reports/financial", async (req, res) => {
  const startDateParam = req.query["startDate"];
  const endDateParam = req.query["endDate"];

  const endDate = toDateOrNull(endDateParam) ?? new Date();
  const startDate = toDateOrNull(startDateParam) ?? new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000);

  if (startDate > endDate) {
    return res.status(400).json({ message: "startDate deve ser menor ou igual a endDate" });
  }

  const periodWhere = {
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  try {
    const [
      totalRestaurants,
      activeSubscriptions,
      trialSubscriptions,
      pastDueSubscriptions,
      deliveredOrdersAggregate,
      deliveredOrders,
      paidInvoicesAggregate,
      openInvoicesAggregate,
      invoiceGroups,
      orderRevenueByRestaurant,
      invoiceRevenueByRestaurant,
      openInvoiceGroupsByRestaurant,
      restaurants,
    ] = await Promise.all([
      prisma.restaurant.count(),
      prisma.subscription.count({ where: { status: "active" } }),
      prisma.subscription.count({ where: { status: "trial" } }),
      prisma.subscription.count({ where: { status: "past_due" } }),
      prisma.order.aggregate({
        where: {
          ...periodWhere,
          status: "delivered",
        },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.order.findMany({
        where: {
          ...periodWhere,
          status: "delivered",
        },
        select: { createdAt: true, total: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.invoice.aggregate({
        where: {
          status: "paid",
          paidAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          status: { in: ["pending", "overdue"] },
          dueDate: {
            lte: endDate,
          },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.invoice.groupBy({
        by: ["status"],
        where: {
          status: { in: ["pending", "overdue", "paid"] },
          OR: [
            { paidAt: { gte: startDate, lte: endDate } },
            { dueDate: { lte: endDate } },
          ],
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.order.groupBy({
        by: ["restaurantId"],
        where: {
          ...periodWhere,
          status: "delivered",
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.invoice.groupBy({
        by: ["restaurantId"],
        where: {
          status: "paid",
          paidAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.invoice.groupBy({
        by: ["restaurantId", "status"],
        where: {
          restaurantId: { not: "" },
          status: { in: ["pending", "overdue"] },
          dueDate: { lte: endDate },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.restaurant.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          subscription: {
            select: {
              status: true,
              price: true,
            },
          },
        },
      }),
    ]);
              planName: true,
              nextBillingAt: true,
            },
          },
        },
      }),
    ]);

    const orderRevenueMap
    }

    const paidInvoiceMap = new Map<string, { paidInvoiceRevenue: number; paidInvoices: number }>();
    for (const row of invoiceRevenueByRestaurant) {
      paidInvoiceMap.set(row.restaurantId, {
        paidInvoiceRevenue: row._sum.amount || 0,
        paidInvoices: row._count._all,
      });
    }

    const openInvoiceMap = new Map<string, { openInvoiceAmount: number; openInvoices: number; overdueInvoiceAmount: number; overdueInvoices: number }>();
    for (const row of openInvoiceGroupsByRestaurant) {
      const previous = openInvoiceMap.get(row.restaurantId) || {
        openInvoiceAmount: 0,
        openInvoices: 0,
        overdueInvoiceAmount: 0,
        overdueInvoices: 0,
      };

      if (row.status === "pending") {
        previous.openInvoiceAmount += row._sum.amount || 0;
        previous.openInvoices += row._count._all;
      }

      if (row.status === "overdue") {
        previous.openInvoiceAmount += row._sum.amount || 0;
        previous.openInvoices += row._count._all;
        previous.overdueInvoiceAmount += row._sum.amount || 0;
        previous.overdueInvoices += row._count._all;
      }

      openInvoiceMap.set(row.restaurantId, previous);
    }

    const dailyRevenueSeries = new Map<string, { date: string; orderRevenue: number; paidInvoiceRevenue: number }>();
    for (let i = 0; i <= daysBetween(startDate, endDate); i += 1) {
      const day = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      dailyRevenueSeries.set(toDayKey(day), { date: toDayKey(day), orderRevenue: 0, paidInvoiceRevenue: 0 });
    }

    for (const order of deliveredOrders) {
      const key = toDayKey(order.createdAt);
      const point = dailyRevenueSeries.get(key);
      if (point) point.orderRevenue += order.total;
    }

    const paidInvoices = await prisma.invoice.findMany({
      where: {
        status: "paid",
        paidAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { paidAt: true, amount: true },
      orderBy: { paidAt: "asc" },
    });

    for (const invoice of paidInvoices) {
      if (!invoice.paidAt) continue;
      const key = toDayKey(invoice.paidAt);
      const point = dailyRevenueSeries.get(key);
      if (point) point.paidInvoiceRevenue += invoice.amount;
    }

    const topRestaurants = restaurants.map((restaurant) => {
      const orderStats = orderRevenueMap.get(restaurant.id) || { orderRevenue: 0, orders: 0 };
      const paidInvoiceStats = paidInvoiceMap.get(restaurant.id) || { paidInvoiceRevenue: 0, paidInvoices: 0 };
      const openInvoiceStats = openInvoiceMap.get(restaurant.id) || {
        openInvoiceAmount: 0,
        openInvoices: 0,
        overdueInvoiceAmount: 0,
        overdueInvoices: 0,
      };

      return {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        orderRevenue: orderStats.orderRevenue,
        totalOrders: orderStats.orders,
        paidInvoiceRevenue: paidInvoiceStats.paidInvoiceRevenue,
        paidInvoices: paidInvoiceStats.paidInvoices,
        openInvoiceAmount: openInvoiceStats.openInvoiceAmount,
        openInvoices: openInvoiceStats.openInvoices,
        overdueInvoiceAmount: openInvoiceStats.overdueInvoiceAmount,
        overdueInvoices: openInvoiceStats.overdueInvoices,
        totalRevenue: orderStats.orderRevenue + paidInvoiceStats.paidInvoiceRevenue,
      };
    })
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 8);

    const subscriptionRevenue = restaurants.reduce((acc, restaurant) => {
      if (restaurant.subscription?.status === "active" || restaurant.subscription?.status === "trial") {
        return acc + (restaurant.subscription.price || 0);
      }
      return acc;
    }, 0);

    const agingBuckets = [
      { key: "0-7", label: "0-7 dias", min: 0, max: 7, count: 0, amount: 0 },
      { key: "8-15", label: "8-15 dias", min: 8, max: 15, count: 0, amount: 0 },
      { key: "16-30", label: "16-30 dias", min: 16, max: 30, count: 0, amount: 0 },
      { key: "31+", label: "31+ dias", min: 31, max: Number.POSITIVE_INFINITY, count: 0, amount: 0 },
    ];

    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["pending", "overdue"] },
        dueDate: { lte: endDate },
      },
      select: { dueDate: true, amount: true, status: true },
    });

    const forecastWindowEnd = new Date(endDate);
    forecastWindowEnd.setDate(forecastWindowEnd.getDate() + 29);
    const forecastRestaurants = restaurants.filter((restaurant) => {
      const status = restaurant.subscription?.status;
      const nextBillingAt = restaurant.subscription?.nextBillingAt;
      return (
        (status === "active" || status === "trial") &&
        nextBillingAt !== null &&
        nextBillingAt >= startDate &&
        nextBillingAt <= forecastWindowEnd
      );
    });

    const forecastSubscriptionRevenue = forecastRestaurants.reduce((acc, restaurant) => {
      return acc + (restaurant.subscription?.price || 0);
    }, 0);

    const forecastOpenInvoiceRevenue = overdueInvoices.reduce((acc, invoice) => acc + invoice.amount, 0);

    const forecastTotalRevenue = forecastSubscriptionRevenue + forecastOpenInvoiceRevenue;

    const dueSoonWindow7 = new Date(endDate);
    dueSoonWindow7.setDate(dueSoonWindow7.getDate() + 7);
    const dueSoonWindow15 = new Date(endDate);
    dueSoonWindow15.setDate(dueSoonWindow15.getDate() + 15);

    const collectionAlerts = restaurants
      .map((restaurant) => {
        const subscription = restaurant.subscription;
        const nextBillingAt = subscription?.nextBillingAt;
        if (!subscription || !nextBillingAt) return null;

        const status = subscription.status;
        const amount = subscription.price || 0;

        if (status === "suspended") {
          return {
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
            status: "suspended" as const,
            dueDate: nextBillingAt.toISOString(),
            amount,
            reason: "assinatura suspensa",
            action: "revisar acesso e regularizar cobrança",
          };
        }

        if (status === "past_due") {
          return {
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
            status: "past_due" as const,
            dueDate: nextBillingAt.toISOString(),
            amount,
            reason: "assinatura em atraso",
            action: "cobrar pagamento pendente",
          };
        }

        if (nextBillingAt <= dueSoonWindow7) {
          return {
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
            status: "due_soon" as const,
            dueDate: nextBillingAt.toISOString(),
            amount,
            reason: "vence em até 7 dias",
            action: "enviar lembrete imediato",
          };
        }

        if (nextBillingAt <= dueSoonWindow15) {
          return {
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
            status: "due_soon" as const,
            dueDate: nextBillingAt.toISOString(),
            amount,
            reason: "vence em até 15 dias",
            action: "programar lembrete preventivo",
          };
        }

        return null;
      })
      .filter((alert): alert is NonNullable<typeof alert> => Boolean(alert))
      .sort((a, b) => {
        const priority = { suspended: 0, past_due: 1, due_soon: 2 } as const;
        if (priority[a.status] !== priority[b.status]) {
          return priority[a.status] - priority[b.status];
        }
        return b.amount - a.amount;
      })
      .slice(0, 8);

    const forecastByWeek = [0, 1, 2, 3, 4].map((weekIndex) => {
      const weekStart = new Date(endDate);
      weekStart.setDate(weekStart.getDate() + weekIndex * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekSubscriptionRevenue = restaurants.reduce((acc, restaurant) => {
        const nextBillingAt = restaurant.subscription?.nextBillingAt;
        const status = restaurant.subscription?.status;
        if (
          (status === "active" || status === "trial") &&
          nextBillingAt !== null &&
          nextBillingAt >= weekStart &&
          nextBillingAt <= weekEnd
        ) {
          return acc + (restaurant.subscription?.price || 0);
        }
        return acc;
      }, 0);

      const weekOpenInvoices = overdueInvoices.reduce((acc, invoice) => {
        const dueDate = invoice.dueDate;
        if (dueDate >= weekStart && dueDate <= weekEnd) {
          return acc + invoice.amount;
        }
        return acc;
      }, 0);

      return {
        label: `Semana ${weekIndex + 1}`,
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
        subscriptionRevenue: weekSubscriptionRevenue,
        openInvoiceRevenue: weekOpenInvoices,
        totalRevenue: weekSubscriptionRevenue + weekOpenInvoices,
      };
    });

    for (const invoice of overdueInvoices) {
      const ageDays = Math.max(0, daysBetween(invoice.dueDate, endDate));
      const bucket = agingBuckets.find((item) => ageDays >= item.min && ageDays <= item.max);
      if (bucket) {
        bucket.count += 1;
        bucket.amount += invoice.amount;
      }
    }

    const deliveredRevenue = deliveredOrdersAggregate._sum.total || 0;
    const paidInvoiceRevenue = paidInvoicesAggregate._sum.amount || 0;
    const openInvoiceAmount = openInvoicesAggregate._sum.amount || 0;
    const totalOpenInvoices = openInvoicesAggregate._count._all;
    const averageTicket = deliveredOrdersAggregate._count._all > 0
      ? deliveredRevenue / deliveredOrdersAggregate._count._all
      : 0;

    const trialToPaidConversion = trialSubscriptions + activeSubscriptions > 0
      ? activeSubscriptions / (trialSubscriptions + activeSubscriptions)
      : 0;

    const arr = subscriptionRevenue * 12;

    const planBreakdownMap = new Map<string, { planName: string; count: number; mrr: number }>();
    for (const restaurant of restaurants) {
      const planName = restaurant.subscription?.status ? restaurant.subscription?.price !== undefined ? restaurant.subscription?.status : "sem plano" : "sem plano";
      const currentPlan = restaurant.subscription?.planName || "Sem assinatura";
      const previous = planBreakdownMap.get(currentPlan) || {
        planName: currentPlan,
        count: 0,
        mrr: 0,
      };

      previous.count += restaurant.subscription ? 1 : 0;
      previous.mrr += restaurant.subscription?.price || 0;
      planBreakdownMap.set(currentPlan, previous);
    }

    const paymentMethodBreakdownMap = new Map<string, { method: string; count: number; amount: number }>();
    const paidInvoicesDetailed = await prisma.invoice.findMany({
      where: {
        status: "paid",
        paidAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { paidAt: true, amount: true, method: true },
      orderBy: { paidAt: "asc" },
    });

    for (const invoice of paidInvoicesDetailed) {
      const method = invoice.method?.trim() || "manual";
      const previous = paymentMethodBreakdownMap.get(method) || {
        method,
        count: 0,
        amount: 0,
      };

      previous.count += 1;
      previous.amount += invoice.amount;
      paymentMethodBreakdownMap.set(method, previous);
    }

    const arpu = activeSubscriptions > 0 ? subscriptionRevenue / activeSubscriptions : 0;
    const ltvEstimated = arpu * 12;

    const retentionCuts = [
      { key: "0-30", label: "0-30 dias", min: 0, max: 30, count: 0, active: 0, retentionRate: 0, revenue: 0 },
      { key: "31-60", label: "31-60 dias", min: 31, max: 60, count: 0, active: 0, retentionRate: 0, revenue: 0 },
      { key: "61-90", label: "61-90 dias", min: 61, max: 90, count: 0, active: 0, retentionRate: 0, revenue: 0 },
      { key: "91+", label: "91+ dias", min: 91, max: Number.POSITIVE_INFINITY, count: 0, active: 0, retentionRate: 0, revenue: 0 },
    ];

    for (const restaurant of restaurants) {
      const ageDays = daysBetween(restaurant.createdAt, endDate);
      const bucket = retentionCuts.find((item) => ageDays >= item.min && ageDays <= item.max);
      if (!bucket) continue;

      const hasSubscription = restaurant.subscription?.status === "active" || restaurant.subscription?.status === "trial";
      bucket.count += 1;
      if (hasSubscription) {
        bucket.active += 1;
        bucket.revenue += restaurant.subscription?.price || 0;
      }
    }

    for (const bucket of retentionCuts) {
      bucket.retentionRate = bucket.count > 0 ? bucket.active / bucket.count : 0;
    }

    const forecastHorizons = [30, 60, 90].map((days) => {
      const horizonEnd = new Date(endDate);
      horizonEnd.setDate(horizonEnd.getDate() + days);

      const subscriptionRevenueForecast = restaurants.reduce((acc, restaurant) => {
        const nextBillingAt = restaurant.subscription?.nextBillingAt;
        const status = restaurant.subscription?.status;
        if (
          (status === "active" || status === "trial") &&
          nextBillingAt !== null &&
          nextBillingAt >= startDate &&
          nextBillingAt <= horizonEnd
        ) {
          return acc + (restaurant.subscription?.price || 0);
        }
        return acc;
      }, 0);

      const openInvoiceRevenueForecast = overdueInvoices.reduce((acc, invoice) => {
        if (invoice.dueDate >= startDate && invoice.dueDate <= horizonEnd) {
          return acc + invoice.amount;
        }
        return acc;
      }, 0);

      return {
        days,
        totalRevenue: subscriptionRevenueForecast + openInvoiceRevenueForecast,
        subscriptionRevenue: subscriptionRevenueForecast,
        openInvoiceRevenue: openInvoiceRevenueForecast,
      };
    });

    return res.json({
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalRestaurants,
        activeSubscriptions,
        trialSubscriptions,
        pastDueSubscriptions,
        orderRevenue: deliveredRevenue,
        deliveredOrders: deliveredOrdersAggregate._count._all,
        paidInvoiceRevenue,
        paidInvoices: paidInvoicesAggregate._count._all,
        openInvoiceAmount,
        openInvoices: totalOpenInvoices,
        subscriptionRevenue,
        averageTicket,
        arr,
        trialToPaidConversion,
        arpu,
        ltvEstimated,
      },
      dailySeries: Array.from(dailyRevenueSeries.values()),
      agingBuckets,
      forecast: {
        windowStart: endDate.toISOString(),
        windowEnd: forecastWindowEnd.toISOString(),
        subscriptionRevenue: forecastSubscriptionRevenue,
        openInvoiceRevenue: forecastOpenInvoiceRevenue,
        totalRevenue: forecastTotalRevenue,
        activeRestaurants: forecastRestaurants.length,
        byWeek: forecastByWeek,
        horizons: forecastHorizons,
      },
      collectionAlerts: {
        dueSoon7Days: collectionAlerts.filter((alert) => alert.reason === "vence em até 7 dias").length,
        dueSoon15Days: collectionAlerts.filter((alert) => alert.reason === "vence em até 15 dias").length,
        pastDue: collectionAlerts.filter((alert) => alert.status === "past_due").length,
        suspended: collectionAlerts.filter((alert) => alert.status === "suspended").length,
        items: collectionAlerts,
      },
      retentionCuts,
      planBreakdown: Array.from(planBreakdownMap.values()).sort((a, b) => b.mrr - a.mrr),
      paymentMethodBreakdown: Array.from(paymentMethodBreakdownMap.values()).sort((a, b) => b.amount - a.amount),
      topRestaurants,
      invoiceStatusBreakdown: invoiceGroups.map((group) => ({
        status: group.status,
        count: group._count._all,
        amount: group._sum.amount || 0,
      })),
    });
  } catch (error) {
    console.error("Erro ao gerar relatório financeiro:", error);
    return res.status(500).json({ message: "Erro ao gerar relatório financeiro" });
  }
});

// GET /platform/control-tower - visão executiva consolidada da plataforma
platformRoutes.get("/control-tower", async (_req, res) => {
  try {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    const previous30Start = new Date(now.getTime() - 59 * 24 * 60 * 60 * 1000);
    const previous30End = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dueSoonWindow7 = new Date(now);
    dueSoonWindow7.setDate(dueSoonWindow7.getDate() + 7);
    const dueSoonWindow15 = new Date(now);
    dueSoonWindow15.setDate(dueSoonWindow15.getDate() + 15);

    const [
      restaurants,
      deliveredOrders30d,
      openInvoiceGroups,
      topRestaurants,
      recentAuditLogs,
      billingAutomationHistory,
      currentPaidInvoices30d,
      previousDeliveredOrders30d,
      previousPaidInvoices30d,
    ] = await Promise.all([
      prisma.restaurant.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          subscription: {
            select: {
              status: true,
              price: true,
              nextBillingAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.groupBy({
        by: ["restaurantId"],
        where: {
          createdAt: { gte: last30Days },
          status: "delivered",
        },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.invoice.groupBy({
        by: ["restaurantId"],
        where: {
          status: { in: ["pending", "overdue"] },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.restaurant.findMany({
        include: {
          _count: {
            select: { orders: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          restaurant: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      readBillingAutomationHistory(),
      prisma.invoice.aggregate({
        where: {
          status: "paid",
          paidAt: {
            gte: last30Days,
            lte: now,
          },
        },
        _sum: { amount: true },
      }),
      prisma.order.aggregate({
        where: {
          createdAt: { gte: previous30Start, lte: previous30End },
          status: "delivered",
        },
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: {
          status: "paid",
          paidAt: { gte: previous30Start, lte: previous30End },
        },
        _sum: { amount: true },
      }),
    ]);

    const deliveredOrdersMap = new Map<string, { orders30d: number; revenue30d: number }>();
    for (const row of deliveredOrders30d) {
      deliveredOrdersMap.set(row.restaurantId, {
        orders30d: row._count._all,
        revenue30d: row._sum.total || 0,
      });
    }

    const openInvoicesMap = new Map<string, { openInvoices: number; openAmount: number }>();
    for (const row of openInvoiceGroups) {
      openInvoicesMap.set(row.restaurantId, {
        openInvoices: row._count._all,
        openAmount: row._sum.amount || 0,
      });
    }

    const billingAlerts = restaurants
      .map((restaurant) => {
        const subscription = restaurant.subscription;
        const invoiceStats = openInvoicesMap.get(restaurant.id) || { openInvoices: 0, openAmount: 0 };
        const deliveryStats = deliveredOrdersMap.get(restaurant.id) || { orders30d: 0, revenue30d: 0 };
        const nextBillingAt = subscription?.nextBillingAt || null;

        const reasons: string[] = [];
        if (!subscription) reasons.push("sem assinatura");
        if (deliveryStats.orders30d === 0) reasons.push("sem pedidos em 30 dias");
        if (invoiceStats.openInvoices > 0) reasons.push(`${invoiceStats.openInvoices} fatura(s) em aberto`);
        if (subscription?.status === "past_due") reasons.push("assinatura em atraso");
        if (subscription?.status === "suspended") reasons.push("assinatura suspensa");

        if (subscription?.status === "suspended") {
          return {
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
            restaurantId: restaurant.id,
            severity: "high" as const,
            category: "billing" as const,
            title: "Assinatura suspensa",
            reason: reasons.join(" · "),
            action: "Reativar se o pagamento foi regularizado",
            status: subscription.status,
            amount: invoiceStats.openAmount,
            dueDate: nextBillingAt?.toISOString() || null,
            recommendedStatus: "active" as const,
          };
        }

        if (subscription?.status === "past_due") {
          return {
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
            restaurantId: restaurant.id,
            severity: "high" as const,
            category: "billing" as const,
            title: "Cobrança em atraso",
            reason: reasons.join(" · "),
            action: "Cobrar pagamento pendente",
            status: subscription.status,
            amount: invoiceStats.openAmount,
            dueDate: nextBillingAt?.toISOString() || null,
            recommendedStatus: "past_due" as const,
          };
        }

        if (nextBillingAt && nextBillingAt <= dueSoonWindow7) {
          return {
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
            restaurantId: restaurant.id,
            severity: "medium" as const,
            category: "billing" as const,
            title: "Cobrança vence em até 7 dias",
            reason: reasons.join(" · ") || "próxima cobrança se aproxima",
            action: "Enviar lembrete imediato",
            status: subscription?.status || null,
            amount: subscription?.price || 0,
            dueDate: nextBillingAt.toISOString(),
            recommendedStatus: null,
          };
        }

        if (nextBillingAt && nextBillingAt <= dueSoonWindow15) {
          return {
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
            restaurantId: restaurant.id,
            severity: "low" as const,
            category: "billing" as const,
            title: "Cobrança vence em até 15 dias",
            reason: reasons.join(" · ") || "programar contato preventivo",
            action: "Programar lembrete preventivo",
            status: subscription?.status || null,
            amount: subscription?.price || 0,
            dueDate: nextBillingAt.toISOString(),
            recommendedStatus: null,
          };
        }

        return null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => {
        const priority = { high: 0, medium: 1, low: 2 } as const;
        if (priority[a.severity] !== priority[b.severity]) return priority[a.severity] - priority[b.severity];
        return (b.amount || 0) - (a.amount || 0);
      })
      .slice(0, 8);

    const operationalAlerts = restaurants
      .map((restaurant) => {
        const deliveryStats = deliveredOrdersMap.get(restaurant.id) || { orders30d: 0, revenue30d: 0 };
        const invoiceStats = openInvoicesMap.get(restaurant.id) || { openInvoices: 0, openAmount: 0 };
        const reasons: string[] = [];

        if (deliveryStats.orders30d === 0) reasons.push("sem pedidos nos últimos 30 dias");
        if (invoiceStats.openInvoices > 0) reasons.push(`${invoiceStats.openInvoices} fatura(s) em aberto`);
        if (restaurant.subscription?.status === "past_due") reasons.push("assinatura em atraso");
        if (restaurant.subscription?.status === "suspended") reasons.push("assinatura suspensa");

        return {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          restaurantId: restaurant.id,
          severity:
            restaurant.subscription?.status === "suspended" || restaurant.subscription?.status === "past_due"
              ? ("high" as const)
              : reasons.length > 0
                ? ("medium" as const)
                : ("low" as const),
          category: "operational" as const,
          title: reasons[0] || "Sem pedidos recentes",
          reason: reasons.join(" · "),
          action: deliveryStats.orders30d === 0 ? "Revisar operação e cardápio" : "Abrir detalhes",
          status: restaurant.subscription?.status || null,
          amount: invoiceStats.openAmount,
          dueDate: null,
          recommendedStatus: null,
        };
      })
      .filter((item) => item.reason.length > 0)
      .sort((a, b) => {
        const priority = { high: 0, medium: 1, low: 2 } as const;
        if (priority[a.severity] !== priority[b.severity]) return priority[a.severity] - priority[b.severity];
        return b.amount - a.amount;
      })
      .slice(0, 8);

    const alerts = [...billingAlerts, ...operationalAlerts].slice(0, 10);

    const currentRevenue30d = (deliveredOrders30d.reduce((acc, row) => acc + (row._sum.total || 0), 0) || 0) + (currentPaidInvoices30d._sum.amount || 0);
    const previousRevenue30d = (previousDeliveredOrders30d._sum.total || 0) + (previousPaidInvoices30d._sum.amount || 0);
    const revenueChangePercent =
      previousRevenue30d > 0 ? ((currentRevenue30d - previousRevenue30d) / previousRevenue30d) * 100 : currentRevenue30d > 0 ? 100 : 0;

    const revenueDropAlert =
      revenueChangePercent <= -15
        ? {
            id: "revenue_drop",
            name: "Plataforma",
            slug: "platform",
            restaurantId: "",
            severity: (revenueChangePercent <= -25 ? "high" : "medium") as "high" | "medium",
            category: "financial" as const,
            title: "Queda de receita detectada",
            reason: `Receita dos últimos 30 dias caiu ${Math.abs(Math.round(revenueChangePercent))}% vs. os 30 dias anteriores`,
            action: "Revisar campanhas, churn e clientes sem pedidos",
            status: null,
            amount: Math.max(0, previousRevenue30d - currentRevenue30d),
            dueDate: null,
            recommendedStatus: null,
          }
        : null;

    const finalAlerts = revenueDropAlert ? [revenueDropAlert, ...alerts].slice(0, 10) : alerts;

    const recentAutomationEvents = billingAutomationHistory.slice(0, 10).map((entry) => ({
      id: `billing_${entry.id}`,
      kind: "automation" as const,
      title: entry.ok ? (entry.trigger === "manual" ? "Billing manual executado" : "Billing automático executado") : "Falha na automação de billing",
      description: entry.ok ? entry.message : entry.error || entry.message,
      restaurantName: null,
      createdAt: entry.createdAt,
      severity: entry.ok ? ("low" as const) : ("high" as const),
      href: "/platform/admin/billing",
    }));

    const recentTimeline = [
      ...recentAuditLogs.map((log) => ({
        id: `audit_${log.id}`,
        kind: "audit" as const,
        title: log.action,
        description: `${log.entityType}${log.entityId ? ` · ${log.entityId}` : ""}${log.metadata ? " · metadata atualizado" : ""}`,
        restaurantName: log.restaurant?.name || null,
        createdAt: log.createdAt.toISOString(),
        severity:
          log.action.includes("DELETED") || log.action.includes("SUSPEND")
            ? ("high" as const)
            : log.action.includes("UPDATED")
              ? ("medium" as const)
              : ("low" as const),
        href: `/platform/admin/restaurants/${log.restaurantId}`,
      })),
      ...recentAutomationEvents,
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    const withoutOrders30d = restaurants.filter((restaurant) => {
      const deliveryStats = deliveredOrdersMap.get(restaurant.id) || { orders30d: 0, revenue30d: 0 };
      return deliveryStats.orders30d === 0;
    }).length;

    const withOpenInvoices = restaurants.filter((restaurant) => {
      const invoiceStats = openInvoicesMap.get(restaurant.id) || { openInvoices: 0, openAmount: 0 };
      return invoiceStats.openInvoices > 0;
    }).length;

    const activeSubscriptions = restaurants.filter((restaurant) => restaurant.subscription?.status === "active").length;
    const trialSubscriptions = restaurants.filter((restaurant) => restaurant.subscription?.status === "trial").length;
    const pastDueSubscriptions = restaurants.filter((restaurant) => restaurant.subscription?.status === "past_due").length;
    const suspendedSubscriptions = restaurants.filter((restaurant) => restaurant.subscription?.status === "suspended").length;

    const openInvoiceAmount = restaurants.reduce((acc, restaurant) => {
      const invoiceStats = openInvoicesMap.get(restaurant.id) || { openInvoices: 0, openAmount: 0 };
      return acc + invoiceStats.openAmount;
    }, 0);

    const overdueSubscriptions = billingAlerts.filter((item) => item.severity === "high").length;
    const dueSoon7Days = billingAlerts.filter((item) => item.reason.includes("7 dias")).length;
    const dueSoon15Days = billingAlerts.filter((item) => item.reason.includes("15 dias")).length;

    const operationalScore = clampScore(100 - withoutOrders30d * 4 - suspendedSubscriptions * 10 - pastDueSubscriptions * 6 - alerts.length * 1.5);
    const financialScore = clampScore(100 - Math.min(50, openInvoiceAmount / 1000) - Math.min(20, dueSoon7Days * 3) - Math.min(15, dueSoon15Days * 1.5));
    const overallScore = clampScore(operationalScore * 0.55 + financialScore * 0.45);

    const topRestaurantsWithRevenue = await Promise.all(
      topRestaurants.map(async (restaurant) => {
        const revenue = await prisma.order.aggregate({
          where: {
            restaurantId: restaurant.id,
            status: "delivered",
          },
          _sum: { total: true },
        });

        return {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          totalOrders: restaurant._count.orders,
          totalRevenue: revenue._sum.total || 0,
        };
      })
    );

    return res.json({
      score: {
        overall: overallScore,
        operational: operationalScore,
        financial: financialScore,
      },
      revenueTrend: {
        current30d: currentRevenue30d,
        previous30d: previousRevenue30d,
        changePercent: revenueChangePercent,
      },
      summary: {
        totalRestaurants: restaurants.length,
        activeSubscriptions,
        trialSubscriptions,
        pastDueSubscriptions,
        suspendedSubscriptions,
        restaurantsWithoutOrders30d: withoutOrders30d,
        restaurantsWithOpenInvoices: withOpenInvoices,
        openInvoiceAmount,
        alertsCount: finalAlerts.length,
      },
      alerts: finalAlerts,
      timeline: recentTimeline,
      topRestaurants: topRestaurantsWithRevenue,
      quickActions: [
        { label: "Ver relatórios", href: "/platform/admin/reports" },
        { label: "Ver mensalidades", href: "/platform/admin/billing" },
        { label: "Abrir restaurantes", href: "/platform/admin/restaurants" },
      ],
      review: {
        dueSoon7Days,
        dueSoon15Days,
        overdueSubscriptions,
      },
    });
  } catch (error) {
    console.error("Erro ao montar control tower:", error);
    return res.status(500).json({ message: "Erro ao montar control tower" });
  }
});

// GET /platform/billing/overview - visão consolidada de mensalidades
platformRoutes.get("/billing/overview", async (req, res) => {
  const { status = "", q = "" } = req.query;
  const statusFilter = String(status).trim();
  const searchTerm = String(q).trim();

  try {
    const restaurants = await prisma.restaurant.findMany({
      where: searchTerm
        ? {
            OR: [
              { name: { contains: searchTerm, mode: "insensitive" } },
              { slug: { contains: searchTerm, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: {
        subscription: true,
        invoices: {
          orderBy: { dueDate: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const filteredRestaurants = statusFilter
      ? restaurants.filter((restaurant) => restaurant.subscription?.status === statusFilter)
      : restaurants;

    const restaurantIds = filteredRestaurants.map((restaurant) => restaurant.id);

    const invoiceGroups = restaurantIds.length
      ? await prisma.invoice.groupBy({
          by: ["restaurantId", "status"],
          where: {
            restaurantId: { in: restaurantIds },
            status: { in: ["pending", "overdue"] },
          },
          _count: { _all: true },
          _sum: { amount: true },
        })
      : [];

    const invoiceStatsByRestaurant = new Map<
      string,
      { pendingInvoices: number; overdueInvoices: number; outstandingAmount: number }
    >();

    for (const group of invoiceGroups) {
      const previous = invoiceStatsByRestaurant.get(group.restaurantId) || {
        pendingInvoices: 0,
        overdueInvoices: 0,
        outstandingAmount: 0,
      };

      if (group.status === "pending") {
        previous.pendingInvoices = group._count._all;
      }

      if (group.status === "overdue") {
        previous.overdueInvoices = group._count._all;
      }

      previous.outstandingAmount += group._sum.amount || 0;
      invoiceStatsByRestaurant.set(group.restaurantId, previous);
    }

    const rows = filteredRestaurants.map((restaurant) => {
      const stats = invoiceStatsByRestaurant.get(restaurant.id) || {
        pendingInvoices: 0,
        overdueInvoices: 0,
        outstandingAmount: 0,
      };

      return {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        createdAt: restaurant.createdAt,
        subscription: restaurant.subscription
          ? {
              id: restaurant.subscription.id,
              planName: restaurant.subscription.planName,
              status: restaurant.subscription.status,
              interval: restaurant.subscription.interval,
              price: restaurant.subscription.price,
              nextBillingAt: restaurant.subscription.nextBillingAt,
              autoRenew: restaurant.subscription.autoRenew,
            }
          : null,
        lastInvoice: restaurant.invoices[0]
          ? {
              id: restaurant.invoices[0].id,
              reference: restaurant.invoices[0].reference,
              amount: restaurant.invoices[0].amount,
              status: restaurant.invoices[0].status,
              dueDate: restaurant.invoices[0].dueDate,
              paidAt: restaurant.invoices[0].paidAt,
            }
          : null,
        pendingInvoices: stats.pendingInvoices,
        overdueInvoices: stats.overdueInvoices,
        outstandingAmount: stats.outstandingAmount,
      };
    });

    const summary = rows.reduce(
      (acc, row) => {
        acc.totalRestaurants += 1;
        if (row.subscription) {
          acc.withSubscription += 1;
          acc.mrr += row.subscription.price;

          if (row.subscription.status === "trial") acc.trial += 1;
          if (row.subscription.status === "active") acc.active += 1;
          if (row.subscription.status === "past_due") acc.pastDue += 1;
          if (row.subscription.status === "suspended") acc.suspended += 1;
          if (row.subscription.status === "canceled") acc.canceled += 1;
        }

        acc.pendingInvoices += row.pendingInvoices;
        acc.overdueInvoices += row.overdueInvoices;
        acc.outstandingAmount += row.outstandingAmount;
        return acc;
      },
      {
        totalRestaurants: 0,
        withSubscription: 0,
        trial: 0,
        active: 0,
        pastDue: 0,
        suspended: 0,
        canceled: 0,
        pendingInvoices: 0,
        overdueInvoices: 0,
        outstandingAmount: 0,
        mrr: 0,
      }
    );

    return res.json({
      summary,
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error("Erro ao listar billing consolidado:", error);
    return res.status(500).json({ message: "Erro ao listar billing consolidado" });
  }
});

// GET /platform/billing/automation/status - status do scheduler/execução
platformRoutes.get("/billing/automation/status", async (_req, res) => {
  return res.json(getBillingAutomationStatus());
});

// GET /platform/billing/automation/history - histórico de execuções do job
platformRoutes.get("/billing/automation/history", async (req, res) => {
  const { page = "1", limit = "20" } = req.query;
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);

  try {
    const history = await readBillingAutomationHistory();
    const count = history.length;
    const totalPages = Math.max(1, Math.ceil(count / pageSize));
    const data = history.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);

    return res.json({
      data,
      count,
      page: pageNumber,
      limit: pageSize,
      totalPages,
    });
  } catch (error) {
    console.error("Erro ao carregar histórico da automação de billing:", error);
    return res.status(500).json({ message: "Erro ao carregar histórico da automação" });
  }
});

// POST /platform/billing/automation/run - executar job manualmente
platformRoutes.post("/billing/automation/run", async (req, res) => {
  try {
    const result = await runBillingAutomation({
      trigger: "manual",
      actorEmail: req.user?.email,
    });

    return res.json({
      message: "Automação de billing executada com sucesso",
      data: result,
    });
  } catch (error) {
    console.error("Erro ao executar automação de billing manualmente:", error);
    return res.status(500).json({
      message: "Erro ao executar automação de billing",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /platform/billing/automation/reprocess - reprocessar competência AAAA-MM
platformRoutes.post("/billing/automation/reprocess", async (req, res) => {
  const { reference } = req.body as { reference?: string };

  if (!reference || typeof reference !== "string") {
    return res.status(400).json({ message: "reference é obrigatória no formato AAAA-MM" });
  }

  const normalizedReference = reference.trim();
  const match = /^(\d{4})-(\d{2})$/.exec(normalizedReference);
  const month = match ? Number(match[2]) : 0;

  if (!match || month < 1 || month > 12) {
    return res.status(400).json({ message: "reference inválida. Use AAAA-MM com mês entre 01 e 12" });
  }

  try {
    const result = await reprocessBillingCompetence({
      reference: normalizedReference,
      actorEmail: req.user?.email,
    });

    return res.json({
      message: "Reprocessamento executado com sucesso",
      data: result,
    });
  } catch (error) {
    console.error("Erro ao reprocessar competência de billing:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      message: errorMessage || "Erro ao reprocessar competência de billing",
      details: errorMessage,
    });
  }
});

// GET /platform/restaurants/:id/audit-logs - trilha de auditoria da loja
platformRoutes.get("/restaurants/:id/audit-logs", async (req, res) => {
  const { id } = req.params;
  const { page = "1", limit = "10", action = "", entityType = "" } = req.query;
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const actionFilter = String(action).trim();
  const entityFilter = String(entityType).trim();

  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurante não encontrado" });
    }

    const where = {
      restaurantId: id,
      ...(actionFilter ? { action: actionFilter } : {}),
      ...(entityFilter ? { entityType: entityFilter } : {}),
    };

    const [logs, count] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return res.json({
      data: logs,
      count,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(count / pageSize),
    });
  } catch (error) {
    console.error("Erro ao listar auditoria:", error);
    return res.status(500).json({ message: "Erro ao listar auditoria" });
  }
});

// GET /platform/restaurants/:id/billing - assinatura e faturas
platformRoutes.get("/restaurants/:id/billing", async (req, res) => {
  const { id } = req.params;

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        subscription: true,
      },
    });

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurante não encontrado" });
    }

    const invoices = await prisma.invoice.findMany({
      where: { restaurantId: id },
      orderBy: { dueDate: "desc" },
      take: 12,
    });

    return res.json({
      subscription: restaurant.subscription,
      invoices,
    });
  } catch (error) {
    console.error("Erro ao buscar billing:", error);
    return res.status(500).json({ message: "Erro ao buscar billing" });
  }
});

// GET /restaurant/billing - Listar cobranças do restaurante logado
platformRoutes.get("/restaurant/billing", async (req, res) => {
  const restaurantId = req.user?.restaurantId; // Assumindo que o ID do restaurante está no token do usuário

  if (!restaurantId) {
    return res.status(403).json({ message: "Acesso negado" });
  }

  const { status = "" } = req.query;
  const statusFilter = String(status).trim();
  const isValidInvoiceStatus = Object.values(InvoiceStatus).includes(statusFilter as InvoiceStatus);

  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        restaurantId,
        ...(statusFilter && isValidInvoiceStatus ? { status: statusFilter as InvoiceStatus } : {}),
      },
      orderBy: { dueDate: "desc" },
    });

    return res.json(invoices);
  } catch (error) {
    console.error("Erro ao buscar cobranças do restaurante:", error);
    return res.status(500).json({ message: "Erro ao buscar cobranças" });
  }
});

// PUT /platform/restaurants/:id/billing - criar/atualizar assinatura
platformRoutes.put("/restaurants/:id/billing", async (req, res) => {
  const { id } = req.params;
  const {
    planName,
    price,
    status,
    interval,
    trialEndsAt,
    currentPeriodStart,
    currentPeriodEnd,
    nextBillingAt,
    autoRenew,
    notes,
  } = req.body;

  const allowedStatuses = ["trial", "active", "past_due", "suspended", "canceled"] as const;
  const allowedIntervals = ["monthly"] as const;

  const parsedPrice = Number(price);
  const normalizedStatus = status || "trial";
  const normalizedInterval = interval || "monthly";

  const parseDateOrNull = (value: unknown) => {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  };

  if (!planName || price === undefined) {
    return res.status(400).json({ message: "planName e price são obrigatórios" });
  }

  if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ message: "price deve ser um número maior ou igual a 0" });
  }

  if (!allowedStatuses.includes(normalizedStatus)) {
    return res.status(400).json({ message: "status inválido para assinatura" });
  }

  if (!allowedIntervals.includes(normalizedInterval)) {
    return res.status(400).json({ message: "interval inválido para assinatura" });
  }

  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurante não encontrado" });
    }

    const updated = await prisma.subscription.upsert({
      where: { restaurantId: id },
      create: {
        restaurantId: id,
        planName,
        price: parsedPrice,
        status: normalizedStatus,
        interval: normalizedInterval,
        trialEndsAt: parseDateOrNull(trialEndsAt),
        currentPeriodStart: parseDateOrNull(currentPeriodStart),
        currentPeriodEnd: parseDateOrNull(currentPeriodEnd),
        nextBillingAt: parseDateOrNull(nextBillingAt),
        autoRenew: autoRenew ?? true,
        notes: notes || null,
      },
      update: {
        planName,
        price: parsedPrice,
        status: normalizedStatus,
        interval: normalizedInterval,
        trialEndsAt: parseDateOrNull(trialEndsAt),
        currentPeriodStart: parseDateOrNull(currentPeriodStart),
        currentPeriodEnd: parseDateOrNull(currentPeriodEnd),
        nextBillingAt: parseDateOrNull(nextBillingAt),
        autoRenew: autoRenew ?? true,
        notes: notes || null,
      },
    });

    await createAuditLog({
      restaurantId: id,
      req,
      action: "BILLING_UPDATED",
      entityType: "Subscription",
      entityId: updated.id,
      metadata: {
        planName,
        price: parsedPrice,
        status: normalizedStatus,
        interval: normalizedInterval,
        autoRenew: autoRenew ?? true,
      },
    });

    return res.json({
      message: "Assinatura atualizada com sucesso",
      data: updated,
    });
  } catch (error) {
    console.error("Erro ao atualizar billing:", error);
    return res.status(500).json({
      message: "Erro ao atualizar billing",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// PATCH /platform/restaurants/:id/billing/status - atualizar somente status da assinatura
platformRoutes.patch("/restaurants/:id/billing/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: "status é obrigatório" });
  }

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { restaurantId: id },
    });

    if (!subscription) {
      return res.status(404).json({ message: "Assinatura não encontrada para este restaurante" });
    }

    const updated = await prisma.subscription.update({
      where: { restaurantId: id },
      data: { status },
    });

    await createAuditLog({
      restaurantId: id,
      req,
      action: "BILLING_STATUS_UPDATED",
      entityType: "Subscription",
      entityId: updated.id,
      metadata: {
        previousStatus: subscription.status,
        newStatus: updated.status,
      },
    });

    return res.json({
      message: "Status da assinatura atualizado com sucesso",
      data: updated,
    });
  } catch (error) {
    console.error("Erro ao atualizar status da assinatura:", error);
    return res.status(500).json({ message: "Erro ao atualizar status da assinatura" });
  }
});

// POST /platform/restaurants/:id/invoices - registrar fatura
platformRoutes.post("/restaurants/:id/invoices", async (req, res) => {
  const { id } = req.params;
  const { reference, amount, dueDate, status, method, notes } = req.body;

  if (!reference || amount === undefined || !dueDate) {
    return res.status(400).json({ message: "reference, amount e dueDate são obrigatórios" });
  }

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: { subscription: true },
    });

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurante não encontrado" });
    }

    const invoice = await prisma.invoice.create({
      data: {
        restaurantId: id,
        subscriptionId: restaurant.subscription?.id,
        reference,
        amount: Number(amount),
        dueDate: new Date(dueDate),
        status: status || "pending",
        method: method || null,
        notes: notes || null,
      },
    });

    await createAuditLog({
      restaurantId: id,
      req,
      action: "INVOICE_CREATED",
      entityType: "Invoice",
      entityId: invoice.id,
      metadata: {
        reference,
        amount: Number(amount),
        status: status || "pending",
      },
    });

    return res.status(201).json({
      message: "Fatura criada com sucesso",
      data: invoice,
    });
  } catch (error) {
    console.error("Erro ao criar fatura:", error);
    return res.status(500).json({ message: "Erro ao criar fatura" });
  }
});

// DELETE /platform/restaurants/:id/invoices/:invoiceId - excluir fatura
platformRoutes.delete("/restaurants/:id/invoices/:invoiceId", async (req, res) => {
  const { id, invoiceId } = req.params;

  try {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        restaurantId: id,
      },
    });

    if (!invoice) {
      return res.status(404).json({ message: "Fatura não encontrada" });
    }

    await prisma.invoice.delete({
      where: { id: invoice.id },
    });

    await reconcileSubscriptionAfterInvoiceChange(id);

    await createAuditLog({
      restaurantId: id,
      req,
      action: "INVOICE_DELETED",
      entityType: "Invoice",
      entityId: invoice.id,
      metadata: {
        reference: invoice.reference,
        amount: invoice.amount,
        status: invoice.status,
      },
    });

    return res.json({ message: "Fatura excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir fatura:", error);
    return res.status(500).json({
      message: "Erro ao excluir fatura",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /platform/settings/payment-gateways - listar configuração de gateways
platformRoutes.get("/settings/payment-gateways", async (_req, res) => {
  try {
    const config = await readPaymentGatewayConfig();

    return res.json({
      openpix: {
        appId: config.openpix.appId,
        appIdMasked: maskSecret(config.openpix.appId),
        baseUrl: config.openpix.baseUrl,
        chargePath: config.openpix.chargePath,
        configured: Boolean(config.openpix.appId),
      },
      mercadopago: {
        clientId: config.mercadopago.clientId,
        clientIdMasked: maskSecret(config.mercadopago.clientId),
        clientSecretMasked: maskSecret(config.mercadopago.clientSecret),
        baseUrl: config.mercadopago.baseUrl,
        configured: Boolean(config.mercadopago.clientId && config.mercadopago.clientSecret),
      },
      updatedAt: config.updatedAt,
    });
  } catch (error) {
    console.error("Erro ao buscar configuração de gateways:", error);
    return res.status(500).json({ message: "Erro ao buscar configuração de gateways" });
  }
});

// PUT /platform/settings/payment-gateways - salvar configuração de gateways
platformRoutes.put("/settings/payment-gateways", async (req, res) => {
  const body = req.body as {
    openpix?: {
      appId?: unknown;
      baseUrl?: unknown;
      chargePath?: unknown;
    };
    mercadopago?: {
      clientId?: unknown;
      clientSecret?: unknown;
      baseUrl?: unknown;
    };
  };

  try {
    const patch = {
      openpix: {
        ...(typeof body.openpix?.appId === "string" ? { appId: body.openpix.appId.trim() } : {}),
        ...(typeof body.openpix?.baseUrl === "string"
          ? { baseUrl: body.openpix.baseUrl.trim() || "https://api.openpix.com.br" }
          : {}),
        ...(typeof body.openpix?.chargePath === "string"
          ? { chargePath: body.openpix.chargePath.trim() || "/api/v1/charge" }
          : {}),
      },
      mercadopago: {
        ...(typeof body.mercadopago?.clientId === "string"
          ? { clientId: body.mercadopago.clientId.trim() }
          : {}),
        ...(typeof body.mercadopago?.clientSecret === "string"
          ? body.mercadopago.clientSecret.trim()
            ? { clientSecret: body.mercadopago.clientSecret.trim() }
            : {}
          : {}),
        ...(typeof body.mercadopago?.baseUrl === "string"
          ? { baseUrl: body.mercadopago.baseUrl.trim() || "https://api.mercadopago.com" }
          : {}),
      },
    };

    const saved = await writePaymentGatewayConfig(patch);

    return res.json({
      message: "Configuração de gateways salva com sucesso",
      openpix: {
        appIdMasked: maskSecret(saved.openpix.appId),
        baseUrl: saved.openpix.baseUrl,
        chargePath: saved.openpix.chargePath,
        configured: Boolean(saved.openpix.appId),
      },
      mercadopago: {
        clientIdMasked: maskSecret(saved.mercadopago.clientId),
        clientSecretMasked: maskSecret(saved.mercadopago.clientSecret),
        baseUrl: saved.mercadopago.baseUrl,
        configured: Boolean(saved.mercadopago.clientId && saved.mercadopago.clientSecret),
      },
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    console.error("Erro ao salvar configuração de gateways:", error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Erro ao salvar configuração de gateways",
    });
  }
});

// POST /platform/settings/payment-gateways/test - testar conexão dos gateways
platformRoutes.post("/settings/payment-gateways/test", async (req, res) => {
  const { gateway = "all" } = (req.body || {}) as { gateway?: "openpix" | "mercadopago" | "all" };

  try {
    if (!["openpix", "mercadopago", "all"].includes(gateway)) {
      return res.status(400).json({ message: "gateway inválido. Use openpix, mercadopago ou all" });
    }

    const result: {
      openpix?: { ok: boolean; message: string };
      mercadopago?: { ok: boolean; message: string };
    } = {};

    if (gateway === "openpix" || gateway === "all") {
      result.openpix = await testOpenPixConnection();
      await appendPaymentTestHistory({
        type: "connection_test",
        gateway: "openpix",
        ok: result.openpix.ok,
        message: result.openpix.message,
        actorEmail: req.user?.email,
      });
    }

    if (gateway === "mercadopago" || gateway === "all") {
      result.mercadopago = await testMercadoPagoConnection();
      await appendPaymentTestHistory({
        type: "connection_test",
        gateway: "mercadopago",
        ok: result.mercadopago.ok,
        message: result.mercadopago.message,
        actorEmail: req.user?.email,
      });
    }

    const hasFailure = [result.openpix, result.mercadopago].some((entry) => entry && !entry.ok);

    return res.status(200).json({
      message: hasFailure
        ? "Um ou mais gateways falharam no teste"
        : "Todos os testes de conexão foram concluídos com sucesso",
      data: result,
    });
  } catch (error) {
    console.error("Erro ao testar gateways:", error);
    return res.status(500).json({ message: "Erro ao testar conexão dos gateways" });
  }
});

// GET /platform/settings/payment-gateways/test-history - histórico de testes/simulações
platformRoutes.get("/settings/payment-gateways/test-history", async (req, res) => {
  try {
    const { gateway = "", type = "", status = "", page = "1", limit = "10" } = req.query;

    const gatewayFilter = String(gateway).trim();
    const typeFilter = String(type).trim();
    const statusFilter = String(status).trim();
    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);

    let history = await readPaymentTestHistory();

    if (gatewayFilter) {
      history = history.filter((entry) => entry.gateway === gatewayFilter);
    }

    if (typeFilter) {
      history = history.filter((entry) => entry.type === typeFilter);
    }

    if (statusFilter === "ok") {
      history = history.filter((entry) => entry.ok);
    }

    if (statusFilter === "error") {
      history = history.filter((entry) => !entry.ok);
    }

    const count = history.length;
    const totalPages = Math.max(1, Math.ceil(count / pageSize));
    const data = history.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);

    return res.json({
      data,
      count,
      page: pageNumber,
      limit: pageSize,
      totalPages,
    });
  } catch (error) {
    console.error("Erro ao carregar histórico de testes:", error);
    return res.status(500).json({ message: "Erro ao carregar histórico de testes" });
  }
});

// DELETE /platform/settings/payment-gateways/test-history - limpar histórico
platformRoutes.delete("/settings/payment-gateways/test-history", async (_req, res) => {
  try {
    await clearPaymentTestHistory();
    return res.json({ message: "Histórico de testes limpo com sucesso" });
  } catch (error) {
    console.error("Erro ao limpar histórico de testes:", error);
    return res.status(500).json({ message: "Erro ao limpar histórico de testes" });
  }
});

// POST /platform/settings/payment-gateways/webhooks/simulate - simula callback de webhook
platformRoutes.post("/settings/payment-gateways/webhooks/simulate", async (req, res) => {
  const body = req.body as { gateway?: PaymentGatewayName; invoiceId?: string };
  const gateway = body.gateway;

  if (!gateway || !["openpix", "mercadopago"].includes(gateway)) {
    return res.status(400).json({ message: "gateway inválido. Use openpix ou mercadopago" });
  }

  try {
    const invoice = body.invoiceId
      ? await prisma.invoice.findUnique({ where: { id: body.invoiceId } })
      : await prisma.invoice.findFirst({
          where: { status: { in: ["pending", "overdue"] } },
          orderBy: { dueDate: "asc" },
        });

    if (!invoice) {
      await appendPaymentTestHistory({
        type: "webhook_simulation",
        gateway,
        ok: false,
        message: "Nenhuma fatura pendente encontrada para simulação",
        actorEmail: req.user?.email,
      });
      return res.status(404).json({ message: "Nenhuma fatura pendente encontrada para simulação" });
    }

    const method = gateway === "openpix" ? "pix_openpix" : "mercadopago";
    const notesPrefix = invoice.notes ? `${invoice.notes}\n` : "";
    const simulationNote = JSON.stringify({
      simulation: true,
      gateway,
      simulatedAt: new Date().toISOString(),
      actorEmail: req.user?.email,
    });

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "paid",
        paidAt: new Date(),
        method,
        notes: `${notesPrefix}${simulationNote}`,
      },
    });

    const pendingOrOverdue = await prisma.invoice.count({
      where: {
        restaurantId: invoice.restaurantId,
        status: { in: ["pending", "overdue"] },
      },
    });

    if (pendingOrOverdue === 0) {
      await prisma.subscription.updateMany({
        where: { restaurantId: invoice.restaurantId },
        data: { status: "active" },
      });
    }

    await appendPaymentTestHistory({
      type: "webhook_simulation",
      gateway,
      ok: true,
      message: `Webhook simulado com sucesso para fatura ${invoice.reference}`,
      actorEmail: req.user?.email,
      metadata: {
        invoiceId: invoice.id,
        reference: invoice.reference,
        restaurantId: invoice.restaurantId,
      },
    });

    return res.json({
      message: "Webhook simulado com sucesso",
      data: {
        gateway,
        invoice: updatedInvoice,
      },
    });
  } catch (error) {
    console.error("Erro ao simular webhook:", error);

    await appendPaymentTestHistory({
      type: "webhook_simulation",
      gateway,
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao simular webhook",
      actorEmail: req.user?.email,
      metadata: body.invoiceId ? { invoiceId: body.invoiceId } : undefined,
    });

    return res.status(500).json({ message: "Erro ao simular webhook" });
  }
});
