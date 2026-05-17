import { type Request, Router } from "express";
import { prisma } from "../../prisma/client.js";
import { createOrder, createOrderByRestaurantId } from "../orders/orders.service.js";

export const menuRoutes = Router();

function getRequestHost(req: Request): string | null {
  const forwardedHost = req.headers["x-forwarded-host"];
  const hostHeader =
    typeof forwardedHost === "string"
      ? forwardedHost.split(",")[0]
      : typeof req.headers.host === "string"
        ? req.headers.host
        : null;

  if (!hostHeader) return null;

  return hostHeader.trim().toLowerCase().split(":")[0] ?? null;
}

async function getMenuPayloadByRestaurantId(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      name: true,
      slug: true,
      phone: true,
      logoUrl: true,
      coverUrl: true,
      description: true,
      instagram: true,
      whatsapp: true,
      facebook: true,
      customDomain: true,
    },
  });

  if (!restaurant) return null;

  const categories = await prisma.category.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { position: "asc" },
    include: {
      products: {
        where: { active: true },
        orderBy: { name: "asc" },
      },
    },
  });

  return { restaurant, categories };
}

// GET /menu/tenant/host — cardápio por domínio customizado
menuRoutes.get("/tenant/host", async (req, res) => {
  const host = getRequestHost(req);

  if (!host) {
    return res.status(400).json({ message: "Host não informado" });
  }

  const restaurant = await prisma.restaurant.findFirst({
    where: { customDomain: host },
    select: { id: true },
  });

  if (!restaurant) {
    return res.status(404).json({ message: "Restaurante não encontrado para este domínio" });
  }

  const payload = await getMenuPayloadByRestaurantId(restaurant.id);
  return res.json(payload);
});

// POST /menu/tenant/host/orders — cria pedido por domínio customizado
menuRoutes.post("/tenant/host/orders", async (req, res) => {
  const host = getRequestHost(req);
  const { tableNumber, items } = req.body as {
    tableNumber?: unknown;
    items?: unknown;
  };

  if (!host) {
    return res.status(400).json({ message: "Host não informado" });
  }

  if (typeof tableNumber !== "number" || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: "tableNumber (número) e items (array com itens) são obrigatórios",
    });
  }

  const restaurant = await prisma.restaurant.findFirst({
    where: { customDomain: host },
    select: { id: true },
  });

  if (!restaurant) {
    return res.status(404).json({ message: "Restaurante não encontrado para este domínio" });
  }

  try {
    const order = await createOrderByRestaurantId({
      restaurantId: restaurant.id,
      tableNumber,
      items,
    });
    return res.status(201).json(order);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao criar pedido";
    return res.status(400).json({ message });
  }
});

// GET /menu/:slug — cardápio público (sem autenticação)
menuRoutes.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!restaurant) {
    return res.status(404).json({ message: "Restaurante não encontrado" });
  }

  const payload = await getMenuPayloadByRestaurantId(restaurant.id);
  return res.json(payload);
});

// POST /menu/:slug/orders — cliente cria pedido (sem autenticação)
menuRoutes.post("/:slug/orders", async (req, res) => {
  const { slug } = req.params;
  const { tableNumber, items } = req.body as {
    tableNumber?: unknown;
    items?: unknown;
  };

  if (typeof tableNumber !== "number" || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: "tableNumber (número) e items (array com itens) são obrigatórios",
    });
  }

  try {
    const order = await createOrder({
      restaurantSlug: slug,
      tableNumber,
      items,
    });
    return res.status(201).json(order);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao criar pedido";
    return res.status(400).json({ message });
  }
});
