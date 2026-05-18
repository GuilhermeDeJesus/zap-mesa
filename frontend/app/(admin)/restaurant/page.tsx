"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../contexts/auth.context";
import { apiFetch } from "../../../services/api";
import type { Restaurant } from "../../../types";

type RestaurantProfile = Restaurant & {
  createdAt?: string;
};

export default function RestaurantPage() {
  const { restaurant, updateRestaurant } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    slug: "",
    phone: "",
    logoUrl: "",
    coverUrl: "",
    description: "",
    instagram: "",
    whatsapp: "",
    facebook: "",
    customDomain: "",
  });

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const profile = await apiFetch<RestaurantProfile>("/restaurant/profile");
        setForm({
          name: profile.name ?? "",
          slug: profile.slug ?? "",
          phone: profile.phone ?? "",
          logoUrl: profile.logoUrl ?? "",
          coverUrl: profile.coverUrl ?? "",
          description: profile.description ?? "",
          instagram: profile.instagram ?? "",
          whatsapp: profile.whatsapp ?? "",
          facebook: profile.facebook ?? "",
          customDomain: profile.customDomain ?? "",
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao carregar perfil");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const publicMenuUrl = useMemo(() => {
    if (form.customDomain.trim()) return `https://${form.customDomain.trim()}/menu/domain/1`;
    if (typeof window === "undefined") return `/menu/${form.slug}/1`;
    return `${window.location.origin}/menu/${form.slug}/1`;
  }, [form.customDomain, form.slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const updated = await apiFetch<RestaurantProfile>("/restaurant/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          phone: form.phone || null,
          logoUrl: form.logoUrl || null,
          coverUrl: form.coverUrl || null,
          description: form.description || null,
          instagram: form.instagram || null,
          whatsapp: form.whatsapp || null,
          facebook: form.facebook || null,
          customDomain: form.customDomain || null,
        }),
      });

      updateRestaurant({
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        phone: updated.phone,
        logoUrl: updated.logoUrl,
        coverUrl: updated.coverUrl,
        description: updated.description,
        instagram: updated.instagram,
        whatsapp: updated.whatsapp,
        facebook: updated.facebook,
        customDomain: updated.customDomain,
      });

      setForm({
        name: updated.name ?? "",
        slug: updated.slug ?? "",
        phone: updated.phone ?? "",
        logoUrl: updated.logoUrl ?? "",
        coverUrl: updated.coverUrl ?? "",
        description: updated.description ?? "",
        instagram: updated.instagram ?? "",
        whatsapp: updated.whatsapp ?? "",
        facebook: updated.facebook ?? "",
        customDomain: updated.customDomain ?? "",
      });
      setSuccess("Configurações salvas com sucesso.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-500">Carregando perfil...</p>;

  return (
    <div className="max-w-5xl space-y-6">
      <section className="rounded-3xl bg-white/90 backdrop-blur border border-white/70 shadow-sm p-6 md:p-7">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500 font-semibold">Multi-tenant</p>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 mt-1">Perfil do Restaurante</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Defina identidade e endereço público do seu tenant. Cada restaurante mantém seus dados isolados.
        </p>
      </section>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          {success}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="bg-white/90 backdrop-blur rounded-3xl border border-white/70 shadow-sm p-5 md:p-6 space-y-4"
        >
          <Field
            label="Nome do restaurante *"
            value={form.name}
            onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
            required
          />

          <Field
            label="Slug público *"
            value={form.slug}
            onChange={(value) => setForm((prev) => ({ ...prev, slug: value.toLowerCase() }))}
            required
            hint="Apenas minúsculas, números e hífen. Ex: churrascaria-centro"
          />

          <Field
            label="Telefone"
            value={form.phone}
            onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
          />

          <Field
            label="Logo (URL)"
            value={form.logoUrl}
            onChange={(value) => setForm((prev) => ({ ...prev, logoUrl: value }))}
            placeholder="https://..."
          />

          <Field
            label="Foto de capa (URL)"
            value={form.coverUrl}
            onChange={(value) => setForm((prev) => ({ ...prev, coverUrl: value }))}
            placeholder="https://..."
            hint="Imagem exibida no topo do cardápio público."
          />

          <Field
            label="Descrição do restaurante"
            value={form.description}
            onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
            placeholder="Um restaurante apaixonado pela culinária nordestina..."
            multiline
          />

          <div className="pt-2">
            <p className="text-xs uppercase tracking-[0.18em] text-orange-500 font-semibold mb-3">Redes Sociais</p>
            <div className="space-y-3">
              <Field
                label="Instagram"
                value={form.instagram}
                onChange={(value) => setForm((prev) => ({ ...prev, instagram: value }))}
                placeholder="@quicopratoeprose"
                prefix="instagram.com/"
              />
              <Field
                label="WhatsApp"
                value={form.whatsapp}
                onChange={(value) => setForm((prev) => ({ ...prev, whatsapp: value }))}
                placeholder="5511999990000"
                hint="Número completo com DDI e DDD, sem espaços. Ex: 5511999990000"
              />
              <Field
                label="Facebook"
                value={form.facebook}
                onChange={(value) => setForm((prev) => ({ ...prev, facebook: value }))}
                placeholder="quicopratoeprose"
                prefix="facebook.com/"
              />
            </div>
          </div>

          <Field
            label="Domínio customizado"
            value={form.customDomain}
            onChange={(value) => setForm((prev) => ({ ...prev, customDomain: value }))}
            placeholder="menu.seurestaurante.com.br"
            hint="No MVP ele é salvo e validado; o roteamento final depende de DNS + proxy (Nginx/Cloudflare)."
          />

          <button
            type="submit"
            disabled={saving}
            className="bg-orange-500 text-white text-sm px-5 py-3 rounded-2xl hover:bg-orange-600 disabled:opacity-50 transition shadow-sm"
          >
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </form>

        <section className="bg-white/90 backdrop-blur rounded-3xl border border-white/70 shadow-sm p-5 md:p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Pré-visualização</h2>

          <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
            <div className="h-24 rounded-2xl overflow-hidden bg-slate-200 flex items-center justify-center">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt={form.name || "Logo"} className="w-full h-full object-cover" />
              ) : (
                <p className="text-xs text-slate-500">Sem logo</p>
              )}
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800">{form.name || "Nome do restaurante"}</p>
            <p className="text-xs text-slate-500">/{form.slug || restaurant?.slug}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Endereço público</p>
            <p className="text-sm font-semibold text-slate-800 break-all mt-1">{publicMenuUrl}</p>
            <p className="text-xs text-slate-500 mt-2">
              Exemplo de mesa usando o fluxo público atual.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            Para ativar domínio customizado em produção: criar DNS CNAME, configurar proxy reverso e certificado SSL.
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  hint,
  multiline,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  prefix?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
        />
      ) : prefix ? (
        <div className="flex items-center border border-slate-200 rounded-2xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-orange-400">
          <span className="text-xs text-slate-400 pl-4 pr-1 whitespace-nowrap">{prefix}</span>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            placeholder={placeholder}
            className="flex-1 py-3 pr-4 text-sm text-slate-900 bg-transparent placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      )}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
