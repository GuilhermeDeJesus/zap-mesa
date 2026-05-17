import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { prisma } from "../../prisma/client.js";
import { buildTableQrCodeDataUrl } from "../../utils/qr-code.js";

export const tablesRoutes = Router();

tablesRoutes.use(authMiddleware);

tablesRoutes.get("/", async (req, res) => {
  const { restaurantId } = req.user!;
  const tables = await prisma.table.findMany({
    where: { restaurantId },
    orderBy: { number: "asc" },
  });

  const withQrCodeImage = await Promise.all(
    tables.map(async (table) => ({
      ...table,
      qrCodeImage: await buildTableQrCodeDataUrl(table.qrCode),
    }))
  );

  return res.json(withQrCodeImage);
});

tablesRoutes.post("/", async (req, res) => {
  const { restaurantId } = req.user!;
  const { number } = req.body as { number?: number };

  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) {
    return res.status(400).json({ message: "number deve ser um inteiro positivo" });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { slug: true },
  });
  if (!restaurant) {
    return res.status(404).json({ message: "Restaurante não encontrado" });
  }

  const existing = await prisma.table.findUnique({
    where: { restaurantId_number: { restaurantId, number } },
  });
  if (existing) {
    return res.status(409).json({ message: "Mesa com esse número já existe" });
  }

  const qrCode = `/menu/${restaurant.slug}/${number}`;
  const table = await prisma.table.create({
    data: { restaurantId, number, qrCode },
  });

  const qrCodeImage = await buildTableQrCodeDataUrl(table.qrCode);
  return res.status(201).json({
    ...table,
    qrCodeImage,
  });
});

tablesRoutes.delete("/:id", async (req, res) => {
  const { restaurantId } = req.user!;
  const { id } = req.params;

  const existing = await prisma.table.findFirst({ where: { id, restaurantId } });
  if (!existing) {
    return res.status(404).json({ message: "Mesa não encontrada" });
  }

  await prisma.table.delete({ where: { id } });
  return res.status(204).send();
});
