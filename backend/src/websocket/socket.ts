import type { Server as HttpServer } from "http";
import { Server, type Server as SocketServer } from "socket.io";

export let io: SocketServer | undefined;

export function initSocket(httpServer: HttpServer): void {
  io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    socket.on("join-restaurant", (restaurantId: string) => {
      void socket.join(restaurantId);
    });
  });
}
