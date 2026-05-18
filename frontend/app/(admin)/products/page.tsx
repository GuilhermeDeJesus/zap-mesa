"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../services/api";
import { formatBRL } from "../../../utils/formatBRL";
import type { Category, Product } from "../../../types";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    image: "",
    price: "",
    categoryId: "",
    active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    const [prods, cats] = await Promise.all([
      apiFetch<Product[]>("/products"),
      apiFetch<Category[]>("/categories"),
    ]);
    setProducts(prods);
    setCategories(cats);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  function openCreate() {
    setEditTarget(null);
    setForm({ name: "", description: "", image: "", price: "", categoryId: "", active: true });
    setError("");
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditTarget(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      image: p.image ?? "",
      price: formatBRL(p.price),
      categoryId: p.categoryId ?? "",
      active: p.active,
    });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const payload = {
      name: form.name,
      description: form.description || undefined,
      image: form.image || undefined,
      price: parseBRLInputToNumber(form.price),
      categoryId: form.categoryId || undefined,
      active: form.active,
    };

    try {
      if (editTarget) {
        const updated = await apiFetch<Product>(`/products/${editTarget.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await apiFetch<Product>("/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setProducts((prev) => [created, ...prev]);
      }
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(p: Product) {
    const updated = await apiFetch<Product>(`/products/${p.id}`, {
      method: "PUT",
      body: JSON.stringify({ active: !p.active }),
    });
    setProducts((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover produto?")) return;
    await apiFetch(`/products/${id}`, { method: "DELETE" });
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  function formatBRLInput(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    const amount = Number(digits) / 100;
    return formatBRL(amount);
  }

  if (loading) return <p className="text-gray-500">Carregando...</p>;

  return (
    <div className="max-w-6xl space-y-6">
      <section className="rounded-3xl bg-white/90 backdrop-blur border border-white/70 shadow-sm p-6 md:p-7">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500 font-semibold">Cardápio interno</p>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 mt-1">Produtos</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Cadastre pratos e lanches com foto, descrição e categoria, mantendo a operação simples.
        </p>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{products.length} produto(s) cadastrados</p>
        <button
          onClick={openCreate}
          className="bg-orange-500 text-white text-sm px-5 py-3 rounded-2xl hover:bg-orange-600 transition shadow-sm"
        >
          + Novo produto
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            onSubmit={(e) => { void handleSubmit(e); }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 border border-white"
          >
            <h2 className="text-lg font-bold text-slate-900">
              {editTarget ? "Editar produto" : "Novo produto"}
            </h2>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                {error}
              </p>
            )}

            <Field
              label="Nome *"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              required
            />
            <Field
              label="Descrição"
              value={form.description}
              onChange={(v) => setForm((f) => ({ ...f, description: v }))}
            />
            <Field
              label="Foto do produto (URL)"
              value={form.image}
              onChange={(v) => setForm((f) => ({ ...f, image: v }))}
              placeholder="https://..."
            />

            <Field
              label="Preço (R$) *"
              type="text"
              value={form.price}
              onChange={(v) => setForm((f) => ({ ...f, price: formatBRLInput(v) }))}
              required
              inputMode="numeric"
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="rounded"
              />
              Produto ativo
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 border border-slate-200 text-slate-700 rounded-2xl py-3 text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-orange-500 text-white rounded-2xl py-3 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 shadow-sm"
              >
                {submitting ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white/90 backdrop-blur rounded-3xl border border-white/70 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Produto</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Categoria</th>
              <th className="text-right px-4 py-3 text-slate-600 font-medium">Preço</th>
              <th className="text-center px-4 py-3 text-slate-600 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-slate-400">
                  Nenhum produto cadastrado
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/80 transition">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                          sem foto
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">{p.name}</p>
                      {p.description && (
                        <p className="text-slate-400 text-xs truncate max-w-xs">{p.description}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">{p.category?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-700">
                  {formatBRL(p.price)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => { void toggleActive(p); }}
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      p.active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {p.active ? "Ativo" : "Inativo"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openEdit(p)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium mr-3"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => { void handleDelete(p.id); }}
                    className="text-xs text-red-500 hover:text-red-600 font-medium"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parseBRLInputToNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits) / 100;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  min,
  step,
  placeholder,
  inputMode,
  pattern,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  min?: string;
  step?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        min={min}
        step={step}
        placeholder={placeholder}
        inputMode={inputMode}
        pattern={pattern}
        className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
      />
    </div>
  );
}
