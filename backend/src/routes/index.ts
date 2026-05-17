import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { authRateLimiter } from "../middlewares/rate-limit.middleware.js";
import { categoriesRoutes } from "../modules/categories/categories.routes.js";
import { menuRoutes } from "../modules/menu/menu.routes.js";
import { ordersRoutes } from "../modules/orders/orders.routes.js";
import { productsRoutes } from "../modules/products/products.routes.js";
import { reportsRoutes } from "../modules/reports/reports.routes.js";
import { restaurantRoutes } from "../modules/restaurant/restaurant.routes.js";
import { tablesRoutes } from "../modules/tables/tables.routes.js";
import { platformRoutes } from "../modules/platform/platform.routes.js";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.use("/auth", authRateLimiter, authRoutes);
router.use("/platform", platformRoutes);
router.use("/categories", categoriesRoutes);
router.use("/products", productsRoutes);
router.use("/restaurant", restaurantRoutes);
router.use("/tables", tablesRoutes);
router.use("/orders", ordersRoutes);
router.use("/reports", reportsRoutes);
router.use("/menu", menuRoutes);
