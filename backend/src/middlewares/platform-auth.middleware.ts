import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type PlatformTokenPayload = {
  userId: string;
  role: string;
  email: string;
  restaurantId?: string;
};

export function platformAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token ausente" });
  }

  const token = authHeader.slice(7);

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "JWT_SECRET nao configurado" });
    }

    const decoded = jwt.verify(token, secret) as PlatformTokenPayload;

    if (decoded.role !== "PLATFORM_OWNER") {
      return res.status(403).json({ message: "Apenas proprietários da plataforma podem acessar" });
    }

    (req as any).user = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: "Token invalido" });
  }
}
