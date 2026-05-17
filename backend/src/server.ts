import "dotenv/config";
import cors from "cors";
import express from "express";
import http from "http";
import { apiRateLimiter } from "./middlewares/rate-limit.middleware.js";
import { router } from "./routes/index.js";
import { initSocket } from "./websocket/socket.js";

const app = express();
const port = Number(process.env["PORT"] ?? 3333);

app.use(cors());
app.use(express.json());
app.use(apiRateLimiter);
app.use(router);

const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(port, () => {
  console.log(`API running on port ${port}`);
});