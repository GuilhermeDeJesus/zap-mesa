import bcrypt from "bcrypt";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../../prisma/client.js";

export const authRoutes = Router();

authRoutes.post("/register-owner", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "name, email e password são obrigatórios",
    });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ message: "Email já cadastrado" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const created = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: "PLATFORM_OWNER",
    },
  });

  return res.status(201).json({
    message: "Proprietário da plataforma criado com sucesso",
    user: {
      id: created.id,
      name: created.name,
      email: created.email,
      role: created.role,
    },
  });
});

authRoutes.post("/register", async (req, res) => {
  const { restaurantName, restaurantSlug, phone, name, email, password } = req.body;

  if (!restaurantName || !restaurantSlug || !name || !email || !password) {
    return res.status(400).json({
      message: "restaurantName, restaurantSlug, name, email e password sao obrigatorios",
    });
  }

  const existingRestaurant = await prisma.restaurant.findUnique({
    where: { slug: restaurantSlug },
  });

  if (existingRestaurant) {
    return res.status(409).json({ message: "Slug de restaurante ja em uso" });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ message: "Email ja cadastrado" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const created = await prisma.restaurant.create({
    data: {
      name: restaurantName,
      slug: restaurantSlug,
      phone,
      users: {
        create: {
          name,
          email,
          password: hashedPassword,
          role: "RESTAURANT_ADMIN",
        },
      },
    },
    include: { users: true },
  });

  const user = created.users[0];

  return res.status(201).json({
    message: "Restaurante criado com sucesso",
    restaurant: {
      id: created.id,
      name: created.name,
      slug: created.slug,
      phone: created.phone,
      logoUrl: created.logoUrl,
      customDomain: created.customDomain,
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});

authRoutes.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "email e password sao obrigatorios" });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { restaurant: true },
  });

  if (!user) {
    return res.status(401).json({ message: "Credenciais invalidas" });
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    return res.status(401).json({ message: "Credenciais invalidas" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: "JWT_SECRET nao configurado" });
  }

  const token = jwt.sign(
    {
      userId: user.id,
      restaurantId: user.restaurantId,
      role: user.role,
      email: user.email,
    },
    secret,
    { expiresIn: "7d" }
  );

  const response: Record<string, unknown> = {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
    },
  };

  if (user.restaurant) {
    response.restaurant = {
      id: user.restaurant.id,
      name: user.restaurant.name,
      slug: user.restaurant.slug,
      phone: user.restaurant.phone,
      logoUrl: user.restaurant.logoUrl,
      customDomain: user.restaurant.customDomain,
    };
  }

  return res.json(response);
});
