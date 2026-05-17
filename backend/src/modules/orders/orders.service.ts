import { type OrderStatus } from "@prisma/client";
import { prisma } from "../../prisma/client.js";
import { io } from "../../websocket/socket.js";

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

type OrderItemInput = {
  productId: string;
  quantity: number;
  notes?: string;
};

type CreateOrderInput = {
  restaurantSlug: string;
  tableNumber: number;
  items: OrderItemInput[];
};

type CreateOrderByRestaurantIdInput = {
  restaurantId: string;
  tableNumber: number;
  items: OrderItemInput[];
};

async function createOrderInternal(
  restaurantId: string,
  tableNumber: number,
  items: OrderItemInput[],
) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw new Error("Restaurante não encontrado");

  const table = await prisma.table.findUnique({
    where: { restaurantId_number: { restaurantId: restaurant.id, number: tableNumber } },
  });
  if (!table) throw new Error("Mesa não encontrada");

  if (items.length === 0) throw new Error("O pedido deve ter ao menos 1 item");

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, restaurantId: restaurant.id, active: true },
  });

  if (products.length !== productIds.length) {
    throw new Error("Um ou mais produtos são inválidos ou inativos");
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  let total = 0;

  const orderItems = items.map((item) => {
    const product = productMap.get(item.productId)!;
    total += product.price * item.quantity;
    return {
      productId: item.productId,
      quantity: item.quantity,
      notes: item.notes,
      price: product.price,
    };
  });

  const order = await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      tableId: table.id,
      total,
      items: { create: orderItems },
    },
    include: { items: { include: { product: true } }, table: true },
  });

  io?.to(restaurant.id).emit("new-order", order);
  return order;
}

export async function createOrder({ restaurantSlug, tableNumber, items }: CreateOrderInput) {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: restaurantSlug } });
  if (!restaurant) throw new Error("Restaurante não encontrado");

  return createOrderInternal(restaurant.id, tableNumber, items);
}

export async function createOrderByRestaurantId({
  restaurantId,
  tableNumber,
  items,
}: CreateOrderByRestaurantIdInput) {
  return createOrderInternal(restaurantId, tableNumber, items);
}

export async function updateOrderStatus(
  orderId: string,
  restaurantId: string,
  newStatus: OrderStatus,
) {
  const order = await prisma.order.findFirst({ where: { id: orderId, restaurantId } });
  if (!order) throw new Error("Pedido não encontrado");

  const validNext = VALID_TRANSITIONS[order.status];
  if (!validNext.includes(newStatus)) {
    throw new Error(
      `Transição inválida: ${order.status} → ${newStatus}. Permitido: ${validNext.join(", ") || "nenhuma"}`,
    );
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus },
    include: { items: { include: { product: true } }, table: true },
  });

  io?.to(restaurantId).emit("order-updated", updated);
  return updated;
}
