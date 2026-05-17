import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { prisma } from "../../prisma/client.js";

export const productsRoutes = Router();

productsRoutes.use(authMiddleware);

productsRoutes.get("/", async (req, res) => {
  const restaurantId = req.user!.restaurantId;

  const products = await prisma.product.findMany({
    where: { restaurantId },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return res.json(products);
});

productsRoutes.post("/", async (req, res) => {
  const restaurantId = req.user!.restaurantId;
  const { name, description, price, image, active, categoryId } = req.body as {
    name?: string;
    description?: string;
    price?: number;
    image?: string;
    active?: boolean;
    categoryId?: string;
  };

  if (!name || typeof price !== "number") {
    return res.status(400).json({ message: "name e price (number) são obrigatórios" });
  }

  if (categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: categoryId, restaurantId } });
    if (!cat) return res.status(400).json({ message: "Categoria inválida" });
  }

  const product = await prisma.product.create({
    data: { restaurantId, name, description, price, image, active: active ?? true, categoryId },
    include: { category: { select: { id: true, name: true } } },
  });

  return res.status(201).json(product);
});

productsRoutes.put("/:id", async (req, res) => {
  const restaurantId = req.user!.restaurantId;
  const { id } = req.params;
  const { name, description, price, image, active, categoryId } = req.body as {
    name?: string;
    description?: string;
    price?: number;
    image?: string;
    active?: boolean;
    categoryId?: string | null;
  };

  const existing = await prisma.product.findFirst({ where: { id, restaurantId } });
  if (!existing) {
    return res.status(404).json({ message: "Produto não encontrado" });
  }

  if (categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: categoryId, restaurantId } });
    if (!cat) return res.status(400).json({ message: "Categoria inválida" });
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      description: description ?? existing.description,
      price: typeof price === "number" ? price : existing.price,
      image: image ?? existing.image,
      active: typeof active === "boolean" ? active : existing.active,
      categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
    },
    include: { category: { select: { id: true, name: true } } },
  });

  return res.json(product);
});

productsRoutes.delete("/:id", async (req, res) => {
  const restaurantId = req.user!.restaurantId;
  const { id } = req.params;

  const existing = await prisma.product.findFirst({ where: { id, restaurantId } });
  if (!existing) {
    return res.status(404).json({ message: "Produto não encontrado" });
  }

  await prisma.product.delete({ where: { id } });
  return res.status(204).send();
});


productsRoutes.use(authMiddleware);

productsRoutes.get("/", async (req, res) => {
  const restaurantId = req.user!.restaurantId;

  const products = await prisma.product.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
  });

  return res.json(products);
});

productsRoutes.post("/", async (req, res) => {
  const restaurantId = req.user!.restaurantId;
  const { name, description, price, image, active } = req.body;

  if (!name || typeof price !== "number") {
    return res.status(400).json({ message: "name e price (number) sao obrigatorios" });
  }

  const product = await prisma.product.create({
    data: {
      restaurantId,
      name,
      description,
      price,
      image,
      active: active ?? true,
    },
  });

  return res.status(201).json(product);
});

productsRoutes.put("/:id", async (req, res) => {
  const restaurantId = req.user!.restaurantId;
  const { id } = req.params;
  const { name, description, price, image, active } = req.body;

  const existing = await prisma.product.findFirst({ where: { id, restaurantId } });
  if (!existing) {
    return res.status(404).json({ message: "Produto nao encontrado" });
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      description: description ?? existing.description,
      price: typeof price === "number" ? price : existing.price,
      image: image ?? existing.image,
      active: typeof active === "boolean" ? active : existing.active,
    },
  });

  return res.json(product);
});

productsRoutes.delete("/:id", async (req, res) => {
  const restaurantId = req.user!.restaurantId;
  const { id } = req.params;

  const existing = await prisma.product.findFirst({ where: { id, restaurantId } });
  if (!existing) {
    return res.status(404).json({ message: "Produto nao encontrado" });
  }

  await prisma.product.delete({ where: { id } });
  return res.status(204).send();
});
