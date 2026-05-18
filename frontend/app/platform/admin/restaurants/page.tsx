"use client";

import { apiFetch } from "@/services/api";
import { formatBRL } from "../../../../utils/formatBRL";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type RestaurantData = {
  id: string;
  name: string;
  slug: string;
  phone?: string;
  logoUrl?: string;
  customDomain?: string;
  createdAt: string;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
  _count: {
    orders: number;
    products: number;
    tables: number;
    categories: number;
  };
  totalRevenue: number;
};

type RestaurantsResponse = {
  data: RestaurantData[];
  count: number;
};

const initialFormState = {
  name: "",
  slug: "",
  phone: "",
};

export default function RestaurantesPage() {
  const [restaurants, setRestaurants] = useState<RestaurantData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch<RestaurantsResponse>("/platform/restaurants");
      setRestaurants(data.data);
    } catch (error) {
      console.error("Erro ao carregar restaurantes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.slug) {
      alert("Nome e slug são obrigatórios");
      return;
    }

    try {
      setIsSubmitting(true);
      await apiFetch("/platform/restaurants", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setFormData(initialFormState);
      setShowForm(false);
      await loadRestaurants();
    } catch (error) {
      console.error("Erro ao criar restaurante:", error);
      alert("Erro ao criar restaurante");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRestaurants = useMemo(
    () =>
      restaurants.filter(
        (restaurant) =>
          restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          restaurant.slug.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [restaurants, searchTerm]
  );

  const summary = useMemo(() => {
    return restaurants.reduce(
      (acc, restaurant) => {
        acc.totalRestaurants += 1;
        acc.totalOrders += restaurant._count.orders;
        acc.totalRevenue += restaurant.totalRevenue;
        acc.totalUsers += restaurant.users.length;
        return acc;
      },
      { totalRestaurants: 0, totalOrders: 0, totalRevenue: 0, totalUsers: 0 }
    );
  }, [restaurants]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-800 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
              Operacao da plataforma
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Restaurantes</h1>
            <p className="mt-2 max-w-2xl text-sm text-cyan-100/80 sm:text-base">
              Controle centralizado das lojas: acompanhe desempenho, equipe e saude comercial em um painel unico.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
          >
            {showForm ? "Cancelar" : "Novo restaurante"}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white/10 p-4">
            <p className="text-xs uppercase tracking-wide text-cyan-100/80">Lojas</p>
            <p className="mt-1 text-2xl font-black">{summary.totalRestaurants}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-4">
            <p className="text-xs uppercase tracking-wide text-cyan-100/80">Pedidos</p>
            <p className="mt-1 text-2xl font-black">{summary.totalOrders}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-4">
            <p className="text-xs uppercase tracking-wide text-cyan-100/80">Usuarios</p>
            <p className="mt-1 text-2xl font-black">{summary.totalUsers}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-4">
            <p className="text-xs uppercase tracking-wide text-cyan-100/80">Receita</p>
            <p className="mt-1 text-2xl font-black">
              {formatBRL(summary.totalRevenue)}
            </p>
          </div>
        </div>
      </section>

      {showForm && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-900 sm:text-xl">Criar novo restaurante</h2>
          <p className="mt-1 text-sm text-slate-500">
            Defina os dados iniciais da loja. O slug vira o caminho publico do cardapio.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Nome do Restaurante
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="ex: Churrascaria do João"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Slug (URL amigável)
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value.toLowerCase() })
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="ex: churrascaria-joao"
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData(initialFormState);
                }}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? "Criando..." : "Criar Restaurante"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="surface-card stagger-fade rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">Lista de restaurantes</p>
            <p className="text-xs text-slate-500">
              {filteredRestaurants.length} de {restaurants.length} resultados
            </p>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou slug"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm sm:max-w-sm"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {filteredRestaurants.length > 0 ? (
          filteredRestaurants.map((restaurant) => (
            <div
              key={restaurant.id}
              className="surface-card interactive-lift group stagger-fade rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900 sm:text-xl">{restaurant.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">/{restaurant.slug}</p>
                  {restaurant.phone && <p className="text-sm text-slate-500">{restaurant.phone}</p>}
                  {restaurant.customDomain && (
                    <p className="mt-1 text-sm font-medium text-blue-600">{restaurant.customDomain}</p>
                  )}
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Ativo
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Categorias</p>
                  <p className="text-xl font-black text-slate-900">
                    {restaurant._count.categories}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Produtos</p>
                  <p className="text-xl font-black text-slate-900">{restaurant._count.products}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Mesas</p>
                  <p className="text-xl font-black text-slate-900">{restaurant._count.tables}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Pedidos</p>
                  <p className="text-xl font-black text-slate-900">{restaurant._count.orders}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-gradient-to-r from-blue-50 via-cyan-50 to-indigo-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Receita total</p>
                <p className="text-2xl font-black text-blue-700 sm:text-3xl">
                  {formatBRL(restaurant.totalRevenue)}
                </p>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  Usuários ({restaurant.users.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {restaurant.users.map((user) => (
                    <span
                      key={user.id}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                    >
                      {user.name} <span className="text-xs text-slate-500">({user.role})</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <Link
                  href={`/platform/admin/restaurants/${restaurant.id}`}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-blue-700"
                >
                  Ver Detalhes
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <h3 className="text-xl font-black text-slate-900">
              Nenhum restaurante encontrado
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {searchTerm
                ? "Tente ajustar seus critérios de busca"
                : "Crie seu primeiro restaurante para começar"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
