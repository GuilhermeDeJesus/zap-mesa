import { type OrderStatus } from "@prisma/client";
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { prisma } from "../../prisma/client.js";
import { updateOrderStatus } from "./orders.service.js";

export const ordersRoutes = Router();

ordersRoutes.use(authMiddleware);

ordersRoutes.get("/", async (req, res) => {
  const { restaurantId } = req.user!;
  const { status } = req.query;

  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      ...(status ? { status: status as OrderStatus } : {}),
    },
    include: { items: { include: { product: true } }, table: true },
    orderBy: { createdAt: "desc" },
  });

  return res.json(orders);
});

ordersRoutes.patch("/:id/status", async (req, res) => {
  const { restaurantId } = req.user!;
  const { id } = req.params;
  const { status } = req.body as { status?: string };

  if (!status) {
    return res.status(400).json({ message: "status é obrigatório" });
  }

  try {
    const order = await updateOrderStatus(id, restaurantId, status as OrderStatus);
    return res.json(order);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao atualizar status";
    return res.status(400).json({ message });
  }
});
