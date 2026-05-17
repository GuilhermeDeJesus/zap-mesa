import rateLimit from "express-rate-limit";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Muitas tentativas de autenticação. Tente novamente em alguns minutos.",
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX ?? 600),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Limite de requisições atingido. Aguarde e tente novamente.",
  },
});
