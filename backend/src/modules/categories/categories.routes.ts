import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { prisma } from "../../prisma/client.js";

export const categoriesRoutes = Router();

categoriesRoutes.use(authMiddleware);

categoriesRoutes.get("/", async (req, res) => {
  const { restaurantId } = req.user!;
  const categories = await prisma.category.findMany({
    where: { restaurantId },
    orderBy: { position: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return res.json(categories);
});

categoriesRoutes.post("/", async (req, res) => {
  const { restaurantId } = req.user!;
  const { name, position } = req.body as { name?: string; position?: number };

  if (!name) {
    return res.status(400).json({ message: "name é obrigatório" });
  }

  const category = await prisma.category.create({
    data: { restaurantId, name, position: position ?? 0 },
  });
  return res.status(201).json(category);
});

categoriesRoutes.put("/:id", async (req, res) => {
  const { restaurantId } = req.user!;
  const { id } = req.params;
  const { name, position } = req.body as { name?: string; position?: number };

  const existing = await prisma.category.findFirst({ where: { id, restaurantId } });
  if (!existing) {
    return res.status(404).json({ message: "Categoria não encontrada" });
  }

  const category = await prisma.category.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      position: position ?? existing.position,
    },
  });
  return res.json(category);
});

categoriesRoutes.delete("/:id", async (req, res) => {
  const { restaurantId } = req.user!;
  const { id } = req.params;

  const existing = await prisma.category.findFirst({ where: { id, restaurantId } });
  if (!existing) {
    return res.status(404).json({ message: "Categoria não encontrada" });
  }

  await prisma.category.delete({ where: { id } });
  return res.status(204).send();
});
