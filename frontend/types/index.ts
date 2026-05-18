export type Restaurant = {
  id: string;
  name: string;
  slug: string;
  phone?: string;
  logoUrl?: string;
  coverUrl?: string;
  description?: string;
  instagram?: string;
  whatsapp?: string;
  facebook?: string;
  customDomain?: string;
};

export type UserRole = "PLATFORM_OWNER" | "RESTAURANT_ADMIN" | "RESTAURANT_STAFF";

export type User = {
  id: string;
  name: string;
  email: string;
  restaurantId?: string;
  role: UserRole;
};

export type AuthData = {
  token: string;
  user: User;
  restaurant: Restaurant;
};

export type Category = {
  id: string;
  name: string;
  position: number;
  _count?: { products: number };
};

export type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  active: boolean;
  categoryId?: string;
  category?: Pick<Category, "id" | "name">;
};

export type Table = {
  id: string;
  number: number;
  qrCode: string;
  qrCodeImage?: string;
};

export type OrderStatus = "pending" | "preparing" | "ready" | "delivered" | "cancelled";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Novo",
  preparing: "Preparando",
  ready: "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  delivered: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

export type OrderItem = {
  id: string;
  quantity: number;
  notes?: string;
  price: number;
  product: Product;
};

export type Order = {
  id: string;
  status: OrderStatus;
  total: number;
  tableId: string;
  table: Table;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type MenuData = {
  restaurant: Restaurant;
  categories: (Category & { products: Product[] })[];
};

export type ReportsSummary = {
  grossRevenue: number;
  deliveredRevenue: number;
  totalOrders: number;
  deliveredOrders: number;
  averageTicket: number;
};

export type ReportsStatusCounts = Record<OrderStatus, number>;

export type ReportsSeriesPoint = {
  date: string;
  revenue: number;
  orders: number;
};

export type ReportsTopProduct = {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
};

export type ReportsData = {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: ReportsSummary;
  statusCounts: ReportsStatusCounts;
  series: ReportsSeriesPoint[];
  topProducts: ReportsTopProduct[];
};
