"use client";

import Link from "next/link";
import { formatBRL } from "../../../../../utils/formatBRL";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/services/api";
import type { UserRole } from "@/types";

const RESTAURANT_ROLE_OPTIONS: UserRole[] = ["RESTAURANT_ADMIN", "RESTAURANT_STAFF"];

type RestaurantDetails = {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  logoUrl?: string | null;
  customDomain?: string | null;
  createdAt: string;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
  }>;
  _count: {
    orders: number;
    products: number;
    tables: number;
    categories: number;
  };
  totalRevenue: number;
  subscription?: {
    id: string;
    planName: string;
    status: "trial" | "active" | "past_due" | "suspended" | "canceled";
    interval: "monthly";
    price: number;
    trialEndsAt?: string | null;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    nextBillingAt?: string | null;
    autoRenew: boolean;
    notes?: string | null;
  } | null;
};

type RestaurantUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

type UsersResponse = {
  data: RestaurantUser[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
};

type AuditLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actorEmail?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

type AuditLogsResponse = {
  data: AuditLogItem[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
};

type BillingStatus = "trial" | "active" | "past_due" | "suspended" | "canceled";

type BillingSubscription = {
  id: string;
  planName: string;
  status: BillingStatus;
  interval: "monthly";
  price: number;
  trialEndsAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  nextBillingAt?: string | null;
  autoRenew: boolean;
  notes?: string | null;
};

type InvoiceItem = {
  id: string;
  reference: string;
  amount: number;
  status: "pending" | "paid" | "overdue" | "canceled";
  dueDate: string;
  paidAt?: string | null;
  method?: string | null;
  notes?: string | null;
  createdAt: string;
};

type BillingResponse = {
  subscription: BillingSubscription | null;
  invoices: InvoiceItem[];
};

export default function RestaurantDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const restaurantId = params?.id;

  const [restaurant, setRestaurant] = useState<RestaurantDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isManagingUsers, setIsManagingUsers] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [userError, setUserError] = useState("");
  const [auditError, setAuditError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    phone: "",
    customDomain: "",
    logoUrl: "",
  });
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "RESTAURANT_STAFF" as UserRole,
  });
  const [editUserForm, setEditUserForm] = useState({
    name: "",
    email: "",
    role: "RESTAURANT_STAFF" as UserRole,
    password: "",
  });
  const [users, setUsers] = useState<RestaurantUser[]>([]);
  const [usersCount, setUsersCount] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersRoleFilter, setUsersRoleFilter] = useState<"" | UserRole>("");
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [billing, setBilling] = useState<BillingSubscription | null>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [billingError, setBillingError] = useState("");
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingForm, setBillingForm] = useState({
    planName: "Plano Mensal",
    price: "",
    status: "trial" as BillingStatus,
    interval: "monthly" as const,
    trialEndsAt: "",
    currentPeriodStart: "",
    currentPeriodEnd: "",
    nextBillingAt: "",
    autoRenew: true,
    notes: "",
  });
  const [invoiceForm, setInvoiceForm] = useState({
    reference: "",
    amount: "",
    dueDate: "",
    status: "pending" as InvoiceItem["status"],
    method: "",
    notes: "",
  });
  const [invoiceSaving, setInvoiceSaving] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    void loadRestaurant(restaurantId);
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    void loadUsers(restaurantId);
  }, [restaurantId, usersPage, usersSearch, usersRoleFilter]);

  useEffect(() => {
    if (!restaurantId) return;
    void loadAuditLogs(restaurantId);
  }, [restaurantId, auditPage]);

  useEffect(() => {
    if (!restaurantId) return;
    void loadBilling(restaurantId);
  }, [restaurantId]);

  async function loadRestaurant(id: string) {
    try {
      setIsLoading(true);
      setError("");
      const data = await apiFetch<RestaurantDetails>(`/platform/restaurants/${id}`);
      setRestaurant(data);
      setUsers(data.users || []);
      setUsersCount(data.users?.length || 0);
      setFormData({
        name: data.name,
        slug: data.slug,
        phone: data.phone || "",
        customDomain: data.customDomain || "",
        logoUrl: data.logoUrl || "",
      });
      if (data.subscription) {
        setBilling(data.subscription);
        setBillingForm({
          planName: data.subscription.planName,
          price: formatBRL(data.subscription.price),
          status: data.subscription.status,
          interval: data.subscription.interval,
          trialEndsAt: data.subscription.trialEndsAt ? data.subscription.trialEndsAt.slice(0, 10) : "",
          currentPeriodStart: data.subscription.currentPeriodStart ? data.subscription.currentPeriodStart.slice(0, 10) : "",
          currentPeriodEnd: data.subscription.currentPeriodEnd ? data.subscription.currentPeriodEnd.slice(0, 10) : "",
          nextBillingAt: data.subscription.nextBillingAt ? data.subscription.nextBillingAt.slice(0, 10) : "",
          autoRenew: data.subscription.autoRenew,
          notes: data.subscription.notes || "",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar restaurante");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadUsers(id: string) {
    try {
      setUserError("");
      const query = new URLSearchParams({
        page: String(usersPage),
        limit: "5",
      });

      if (usersSearch.trim()) query.set("q", usersSearch.trim());
      if (usersRoleFilter) query.set("role", usersRoleFilter);

      const response = await apiFetch<UsersResponse>(`/platform/restaurants/${id}/users?${query}`);
      setUsers(response.data);
      setUsersCount(response.count);
      setUsersTotalPages(response.totalPages || 1);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Erro ao carregar usuarios");
    }
  }

  async function loadAuditLogs(id: string) {
    try {
      setAuditError("");
      const query = new URLSearchParams({
        page: String(auditPage),
        limit: "6",
      });

      const response = await apiFetch<AuditLogsResponse>(`/platform/restaurants/${id}/audit-logs?${query}`);
      setAuditLogs(response.data);
      setAuditTotalPages(response.totalPages || 1);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : "Erro ao carregar auditoria");
    }
  }

  async function loadBilling(id: string) {
    try {
      setBillingError("");
      const response = await apiFetch<BillingResponse>(`/platform/restaurants/${id}/billing`);
      setBilling(response.subscription);
      setInvoices(response.invoices);

      if (response.subscription) {
        setBillingForm({
          planName: response.subscription.planName,
          price: formatBRL(response.subscription.price),
          status: response.subscription.status,
          interval: response.subscription.interval,
          trialEndsAt: response.subscription.trialEndsAt ? response.subscription.trialEndsAt.slice(0, 10) : "",
          currentPeriodStart: response.subscription.currentPeriodStart ? response.subscription.currentPeriodStart.slice(0, 10) : "",
          currentPeriodEnd: response.subscription.currentPeriodEnd ? response.subscription.currentPeriodEnd.slice(0, 10) : "",
          nextBillingAt: response.subscription.nextBillingAt ? response.subscription.nextBillingAt.slice(0, 10) : "",
          autoRenew: response.subscription.autoRenew,
          notes: response.subscription.notes || "",
        });
      }
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Erro ao carregar billing");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurantId) return;

    try {
      setIsSaving(true);
      setError("");
      await apiFetch(`/platform/restaurants/${restaurantId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          phone: formData.phone || null,
          customDomain: formData.customDomain || null,
          logoUrl: formData.logoUrl || null,
        }),
      });
      await loadRestaurant(restaurantId);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar alteracoes");
    } finally {
      setIsSaving(false);
    }
  }

  function startEditingUser(user: RestaurantDetails["users"][number]) {
    setEditingUserId(user.id);
    setUserError("");
    setEditUserForm({
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      password: "",
    });
  }

  function cancelEditingUser() {
    setEditingUserId(null);
    setEditUserForm({
      name: "",
      email: "",
      role: "RESTAURANT_STAFF",
      password: "",
    });
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurantId) return;

    try {
      setIsCreatingUser(true);
      setUserError("");
      await apiFetch(`/platform/restaurants/${restaurantId}/users`, {
        method: "POST",
        body: JSON.stringify({
          name: newUserForm.name,
          email: newUserForm.email,
          password: newUserForm.password,
          role: newUserForm.role,
        }),
      });

      setNewUserForm({
        name: "",
        email: "",
        password: "",
        role: "RESTAURANT_STAFF",
      });
      await loadRestaurant(restaurantId);
      await loadUsers(restaurantId);
      await loadAuditLogs(restaurantId);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Erro ao criar usuário");
    } finally {
      setIsCreatingUser(false);
    }
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurantId || !editingUserId) return;

    try {
      setIsManagingUsers(true);
      setUserError("");
      await apiFetch(`/platform/restaurants/${restaurantId}/users/${editingUserId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editUserForm.name,
          email: editUserForm.email,
          role: editUserForm.role,
          password: editUserForm.password || undefined,
        }),
      });

      cancelEditingUser();
      await loadRestaurant(restaurantId);
      await loadUsers(restaurantId);
      await loadAuditLogs(restaurantId);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Erro ao atualizar usuário");
    } finally {
      setIsManagingUsers(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!restaurantId) return;
    const confirmed = window.confirm("Tem certeza que deseja remover este usuário?");
    if (!confirmed) return;

    try {
      setIsManagingUsers(true);
      setUserError("");
      await apiFetch(`/platform/restaurants/${restaurantId}/users/${userId}`, {
        method: "DELETE",
      });
      await loadRestaurant(restaurantId);
      await loadUsers(restaurantId);
      await loadAuditLogs(restaurantId);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Erro ao remover usuário");
    } finally {
      setIsManagingUsers(false);
    }
  }

  async function handleSaveBilling(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurantId) return;

    try {
      setBillingSaving(true);
      setBillingError("");
      await apiFetch(`/platform/restaurants/${restaurantId}/billing`, {
        method: "PUT",
        body: JSON.stringify({
          planName: billingForm.planName,
          price: parseBRLInputToNumber(billingForm.price),
          status: billingForm.status,
          interval: billingForm.interval,
          trialEndsAt: billingForm.trialEndsAt || null,
          currentPeriodStart: billingForm.currentPeriodStart || null,
          currentPeriodEnd: billingForm.currentPeriodEnd || null,
          nextBillingAt: billingForm.nextBillingAt || null,
          autoRenew: billingForm.autoRenew,
          notes: billingForm.notes || null,
        }),
      });

      await loadRestaurant(restaurantId);
      await loadBilling(restaurantId);
      await loadAuditLogs(restaurantId);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Erro ao salvar billing");
    } finally {
      setBillingSaving(false);
    }
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurantId) return;

    try {
      setInvoiceSaving(true);
      setBillingError("");
      await apiFetch(`/platform/restaurants/${restaurantId}/invoices`, {
        method: "POST",
        body: JSON.stringify({
          reference: invoiceForm.reference,
          amount: parseBRLInputToNumber(invoiceForm.amount),
          dueDate: invoiceForm.dueDate,
          status: invoiceForm.status,
          method: invoiceForm.method || null,
          notes: invoiceForm.notes || null,
        }),
      });

      setInvoiceForm({
        reference: "",
        amount: "",
        dueDate: "",
        status: "pending",
        method: "",
        notes: "",
      });
      await loadBilling(restaurantId);
      await loadAuditLogs(restaurantId);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Erro ao criar fatura");
    } finally {
      setInvoiceSaving(false);
    }
  }

  async function handleDeleteInvoice(invoiceId: string) {
    const confirmed = window.confirm("Tem certeza que deseja excluir esta fatura? Essa ação não pode ser desfeita.");
    if (!confirmed) return;

    try {
      setInvoiceSaving(true);
      setBillingError("");
      await apiFetch(`/platform/restaurants/${restaurantId}/invoices/${invoiceId}`, {
        method: "DELETE",
      });

      await loadBilling(restaurantId);
      await loadAuditLogs(restaurantId);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Erro ao excluir fatura");
    } finally {
      setInvoiceSaving(false);
    }
  }

  const metrics = useMemo(() => {
    if (!restaurant) {
      return [
        { label: "Categorias", value: 0 },
        { label: "Produtos", value: 0 },
        { label: "Mesas", value: 0 },
        { label: "Pedidos", value: 0 },
      ];
    }

    return [
      { label: "Categorias", value: restaurant._count.categories },
      { label: "Produtos", value: restaurant._count.products },
      { label: "Mesas", value: restaurant._count.tables },
      { label: "Pedidos", value: restaurant._count.orders },
    ];
  }, [restaurant]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-blue-600" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="space-y-4 rounded-2xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-2xl font-black text-red-700">Nao foi possivel carregar o restaurante</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Link
          href="/platform/admin/restaurants"
          className="inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Voltar para restaurantes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-800 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
              Detalhes da loja
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{restaurant.name}</h1>
            <p className="mt-2 text-sm text-cyan-100/80 sm:text-base">/{restaurant.slug}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsEditing((prev) => !prev)}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
            >
              {isEditing ? "Cancelar edicao" : "Editar restaurante"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/platform/admin/restaurants")}
              className="rounded-xl border border-white/40 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Voltar
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((item) => (
            <article key={item.label} className="rounded-xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-100/80">{item.label}</p>
              <p className="mt-1 text-2xl font-black">{item.value}</p>
            </article>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <article className="surface-card rounded-2xl p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900">Informacoes da loja</h2>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Ativo
            </span>
          </div>

          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Nome</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Slug</label>
                  <input
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Telefone</label>
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Dominio customizado</label>
                  <input
                    value={formData.customDomain}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, customDomain: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">URL do logo</label>
                <input
                  value={formData.logoUrl}
                  onChange={(e) => setFormData((prev) => ({ ...prev, logoUrl: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      name: restaurant.name,
                      slug: restaurant.slug,
                      phone: restaurant.phone || "",
                      customDomain: restaurant.customDomain || "",
                      logoUrl: restaurant.logoUrl || "",
                    });
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? "Salvando..." : "Salvar alteracoes"}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <div className="surface-soft rounded-xl p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nome</p>
                <p className="mt-1 font-semibold text-slate-900">{restaurant.name}</p>
              </div>
              <div className="surface-soft rounded-xl p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Slug</p>
                <p className="mt-1 font-semibold text-slate-900">/{restaurant.slug}</p>
              </div>
              <div className="surface-soft rounded-xl p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Telefone</p>
                <p className="mt-1 font-semibold text-slate-900">{restaurant.phone || "Nao informado"}</p>
              </div>
              <div className="surface-soft rounded-xl p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dominio</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {restaurant.customDomain || "Sem dominio customizado"}
                </p>
              </div>
              <div className="surface-soft rounded-xl p-3 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receita total</p>
                <p className="mt-1 text-2xl font-black text-blue-700">
                  {formatBRL(restaurant.totalRevenue)}
                </p>
              </div>
            </div>
          )}
        </article>

        <article className="surface-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">Equipe ({restaurant.users.length})</h2>
              <p className="mt-1 text-sm text-slate-500">Gerencie usuarios, papeis e acessos da loja</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px]">
            <input
              value={usersSearch}
              onChange={(e) => {
                setUsersPage(1);
                setUsersSearch(e.target.value);
              }}
              placeholder="Buscar por nome ou email"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={usersRoleFilter}
              onChange={(e) => {
                setUsersPage(1);
                setUsersRoleFilter(e.target.value as "" | UserRole);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Todos os perfis</option>
              {RESTAURANT_ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          {userError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {userError}
            </div>
          )}

          <form onSubmit={handleCreateUser} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Novo usuário</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                value={newUserForm.name}
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nome"
                required
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email"
                required
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Senha inicial"
                required
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={newUserForm.role}
                onChange={(e) =>
                  setNewUserForm((prev) => ({ ...prev, role: e.target.value as UserRole }))
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {RESTAURANT_ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isCreatingUser}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {isCreatingUser ? "Criando..." : "Criar usuário"}
            </button>
          </form>

          <div className="mt-4 space-y-3">
            {users.length > 0 ? (
              users.map((user) => {
                const isEditingThisUser = editingUserId === user.id;

                return (
                  <div key={user.id} className="surface-soft rounded-xl p-3">
                    {isEditingThisUser ? (
                      <form onSubmit={handleUpdateUser} className="space-y-2">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input
                            value={editUserForm.name}
                            onChange={(e) =>
                              setEditUserForm((prev) => ({ ...prev, name: e.target.value }))
                            }
                            required
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                          <input
                            type="email"
                            value={editUserForm.email}
                            onChange={(e) =>
                              setEditUserForm((prev) => ({ ...prev, email: e.target.value }))
                            }
                            required
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                          <input
                            type="password"
                            value={editUserForm.password}
                            onChange={(e) =>
                              setEditUserForm((prev) => ({ ...prev, password: e.target.value }))
                            }
                            placeholder="Nova senha (opcional)"
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                          <select
                            value={editUserForm.role}
                            onChange={(e) =>
                              setEditUserForm((prev) => ({
                                ...prev,
                                role: e.target.value as UserRole,
                              }))
                            }
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          >
                            {RESTAURANT_ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={isManagingUsers}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {isManagingUsers ? "Salvando..." : "Salvar"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditingUser}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {user.role}
                          </span>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditingUser(user)}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteUser(user.id)}
                              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Nenhum usuario encontrado
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600">
            <span>
              Mostrando {users.length} de {usersCount} usuarios
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={usersPage <= 1}
                onClick={() => setUsersPage((prev) => Math.max(prev - 1, 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={usersPage >= usersTotalPages}
                onClick={() => setUsersPage((prev) => prev + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </article>

        <article className="surface-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">Auditoria recente</h2>
              <p className="mt-1 text-sm text-slate-500">Ações administrativas mais recentes</p>
            </div>
          </div>

          {auditError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {auditError}
            </div>
          )}

          <div className="mt-4 space-y-3">
            {auditLogs.length > 0 ? (
              auditLogs.map((log) => (
                <div key={log.id} className="surface-soft rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{log.action}</p>
                      <p className="text-xs text-slate-500">
                        {log.entityType}
                        {log.entityId ? ` · ${log.entityId}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(log.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    <p>Por: {log.actorEmail || "Sistema"}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Nenhum evento registrado
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600">
            <span>
              Página {auditPage} de {auditTotalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={auditPage <= 1}
                onClick={() => setAuditPage((prev) => Math.max(prev - 1, 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={auditPage >= auditTotalPages}
                onClick={() => setAuditPage((prev) => prev + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="surface-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">Mensalidade</h2>
              <p className="mt-1 text-sm text-slate-500">Controle o plano, status e próxima cobrança</p>
            </div>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {billing?.status || "sem assinatura"}
            </span>
          </div>

          {billingError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {billingError}
            </div>
          )}

          <form onSubmit={handleSaveBilling} className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Plano</label>
                <input
                  value={billingForm.planName}
                  onChange={(e) => setBillingForm((prev) => ({ ...prev, planName: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Valor mensal</label>
                <input
                  type="text"
                  value={billingForm.price}
                  onChange={(e) =>
                    setBillingForm((prev) => ({ ...prev, price: formatBRLInput(e.target.value) }))
                  }
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Status</label>
                <select
                  value={billingForm.status}
                  onChange={(e) => setBillingForm((prev) => ({ ...prev, status: e.target.value as BillingStatus }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="trial">trial</option>
                  <option value="active">active</option>
                  <option value="past_due">past_due</option>
                  <option value="suspended">suspended</option>
                  <option value="canceled">canceled</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Intervalo</label>
                <select
                  value={billingForm.interval}
                  onChange={(e) => setBillingForm((prev) => ({ ...prev, interval: e.target.value as "monthly" }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="monthly">monthly</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Fim do trial</label>
                <input
                  type="date"
                  value={billingForm.trialEndsAt}
                  onChange={(e) => setBillingForm((prev) => ({ ...prev, trialEndsAt: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Próxima cobrança</label>
                <input
                  type="date"
                  value={billingForm.nextBillingAt}
                  onChange={(e) => setBillingForm((prev) => ({ ...prev, nextBillingAt: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Início do ciclo</label>
                <input
                  type="date"
                  value={billingForm.currentPeriodStart}
                  onChange={(e) => setBillingForm((prev) => ({ ...prev, currentPeriodStart: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Fim do ciclo</label>
                <input
                  type="date"
                  value={billingForm.currentPeriodEnd}
                  onChange={(e) => setBillingForm((prev) => ({ ...prev, currentPeriodEnd: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="autoRenew"
                type="checkbox"
                checked={billingForm.autoRenew}
                onChange={(e) => setBillingForm((prev) => ({ ...prev, autoRenew: e.target.checked }))}
              />
              <label htmlFor="autoRenew" className="text-sm text-slate-700">Renovação automática</label>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Observações</label>
              <textarea
                value={billingForm.notes}
                onChange={(e) => setBillingForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={billingSaving}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {billingSaving ? "Salvando..." : "Salvar mensalidade"}
            </button>
          </form>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="surface-soft rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Próxima cobrança</p>
              <p className="mt-1 font-semibold text-slate-900">
                {billing?.nextBillingAt ? new Date(billing.nextBillingAt).toLocaleDateString("pt-BR") : "Não definida"}
              </p>
            </div>
            <div className="surface-soft rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Renovação</p>
              <p className="mt-1 font-semibold text-slate-900">{billing?.autoRenew ? "Ativa" : "Desativada"}</p>
            </div>
          </div>
        </article>

        <article className="surface-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">Faturas</h2>
              <p className="mt-1 text-sm text-slate-500">Histórico das cobranças mensais</p>
            </div>
          </div>

          <form onSubmit={handleCreateInvoice} className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nova fatura</p>
            <input
              value={invoiceForm.reference}
              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, reference: e.target.value }))}
              placeholder="Referência ex: 2026-05"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={invoiceForm.amount}
                onChange={(e) =>
                  setInvoiceForm((prev) => ({ ...prev, amount: formatBRLInput(e.target.value) }))
                }
                placeholder="Valor"
                inputMode="numeric"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={invoiceForm.dueDate}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={invoiceForm.status}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, status: e.target.value as InvoiceItem["status"] }))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="pending">pending</option>
                <option value="paid">paid</option>
                <option value="overdue">overdue</option>
                <option value="canceled">canceled</option>
              </select>
              <input
                value={invoiceForm.method}
                onChange={(e) => setInvoiceForm((prev) => ({ ...prev, method: e.target.value }))}
                placeholder="Método"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <textarea
              value={invoiceForm.notes}
              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Observações"
              className="min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={invoiceSaving}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {invoiceSaving ? "Criando..." : "Criar fatura"}
            </button>
          </form>

          <div className="mt-4 space-y-3">
            {invoices.length > 0 ? (
              invoices.map((invoice) => (
                <div key={invoice.id} className="surface-soft rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{invoice.reference}</p>
                      <p className="text-xs text-slate-500">
                        Vencimento: {new Date(invoice.dueDate).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {invoice.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-slate-900">{formatBRL(invoice.amount)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{invoice.method || "sem método"}</span>
                      <button
                        type="button"
                        onClick={() => void handleDeleteInvoice(invoice.id)}
                        disabled={invoiceSaving}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Nenhuma fatura registrada
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

function formatBRLInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return formatBRL(Number(digits) / 100);
}

function parseBRLInputToNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits) / 100;
}
