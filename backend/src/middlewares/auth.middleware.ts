import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

type TokenPayload = {
  userId: string;
  restaurantId: string;
  email: string;
};

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
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

    const decoded = jwt.verify(token, secret) as TokenPayload;
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: "Token invalido" });
  }
}
