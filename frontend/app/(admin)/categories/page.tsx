"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../services/api";
import type { Category } from "../../../types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void apiFetch<Category[]>("/categories").then((data) => {
      setCategories(data);
      setLoading(false);
    });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const cat = await apiFetch<Category>("/categories", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), position: categories.length }),
      });
      setCategories((prev) => [...prev, cat]);
      setName("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar categoria");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover categoria? Os produtos não serão apagados.")) return;
    await apiFetch(`/categories/${id}`, { method: "DELETE" });
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  if (loading) return <p className="text-gray-500">Carregando...</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <section className="rounded-3xl bg-white/90 backdrop-blur border border-white/70 shadow-sm p-6 md:p-7">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500 font-semibold">Organização</p>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 mt-1">Categorias</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Separe os itens do cardápio de forma simples para facilitar a navegação do cliente.
        </p>
      </section>

      <form
        onSubmit={(e) => { void handleCreate(e); }}
        className="bg-white/90 backdrop-blur rounded-3xl border border-white/70 p-5 md:p-6 flex flex-col sm:flex-row gap-3 shadow-sm"
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da categoria..."
          required
          className="flex-1 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-orange-500 text-white text-sm px-5 py-3 rounded-2xl hover:bg-orange-600 disabled:opacity-50 transition shadow-sm"
        >
          {submitting ? "..." : "+ Adicionar"}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">{error}</p>
      )}

      <div className="bg-white/90 backdrop-blur rounded-3xl border border-white/70 divide-y divide-slate-100 overflow-hidden shadow-sm">
        {categories.length === 0 && (
          <p className="text-center py-10 text-slate-400 text-sm">Nenhuma categoria cadastrada</p>
        )}
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 transition">
            <div>
              <p className="text-sm font-semibold text-slate-800">{c.name}</p>
              <p className="text-xs text-slate-400">
                {c._count?.products ?? 0} produto(s)
              </p>
            </div>
            <button
              onClick={() => { void handleDelete(c.id); }}
              className="text-xs text-red-500 hover:text-red-600 font-medium"
            >
              Excluir
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
