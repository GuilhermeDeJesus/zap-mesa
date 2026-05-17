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
    const totalRestaurants = await prisma.restaurant.count();

    const totalOrders = await prisma.order.count();

    const totalRevenue = await prisma.order.aggregate({
      where: { status: "delivered" },
      _sum: { total: true },
    });

    const totalUsers = await prisma.user.count();

    const topRestaurants = await prisma.restaurant.findMany({
      include: {
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

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
      topRestaurants: topRestaurantsWithRevenue,
    });
  } catch (error) {
    console.error("Erro ao buscar analytics:", error);
    return res.status(500).json({ message: "Erro ao buscar analytics" });
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
