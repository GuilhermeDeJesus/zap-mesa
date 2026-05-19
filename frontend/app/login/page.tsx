"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/auth.context";
import type { User } from "../../types";

function getRedirectByUserRole(user: User | null): string {
  if (!user) return "/dashboard";
  if (user.role === "PLATFORM_OWNER") return "/platform/admin/dashboard";
  return "/dashboard";
}

const FEATURES = [
  {
    icon: "📋",
    title: "Cardápio digital via QR Code",
    desc: "Cliente escaneia, escolhe e pede direto da mesa — sem garçom indo e vindo.",
  },
  {
    icon: "⚡",
    title: "Pedidos em tempo real",
    desc: "Cozinha recebe o pedido na hora. Sem papel, sem grito, sem erro de anotação.",
  },
  {
    icon: "🍽️",
    title: "Gestão de mesas e categorias",
    desc: "Crie mesas, organize o cardápio por categorias e mantenha tudo atualizado em minutos.",
  },
  {
    icon: "📊",
    title: "Relatórios de vendas",
    desc: "Veja o que mais vende, os horários de pico e tome decisões baseadas em dados reais.",
  },
];

const STATS = [
  { value: "0 erro", label: "de pedido por anotação perdida" },
  { value: "–30%", label: "no tempo médio de atendimento" },
  { value: "100%", label: "cardápio sempre atualizado" },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, token, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && token) {
      const storedUser = localStorage.getItem("user");
      const parsedUser = storedUser ? (JSON.parse(storedUser) as User) : null;
      router.replace(getRedirectByUserRole(parsedUser));
    }
  }, [isLoading, token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await login(email, password);
      const storedUser = localStorage.getItem("user");
      const parsedUser = storedUser ? (JSON.parse(storedUser) as User) : null;
      router.replace(getRedirectByUserRole(parsedUser));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao fazer login");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,#fff7ed_0%,#f8fafc_40%,#eaf2ff_100%)]">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍕</span>
          <span className="text-lg font-black tracking-tight text-slate-900">
            Zap<span className="text-orange-500">Mesa</span>
          </span>
        </div>
        <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
          MVP · Acesso gratuito
        </span>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-16">

          {/* ── LEFT SIDE ── */}
          <section className="space-y-10">
            {/* Hero */}
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-orange-600">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                Gestão para restaurantes
              </span>
              <h1 className="mt-4 text-4xl font-black leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
                Chega de pedido<br />
                <span className="text-orange-500">perdido ou errado.</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600">
                O ZapMesa digitaliza a operação do seu restaurante do zero: cardápio via QR Code, pedidos direto na cozinha e relatórios de vendas — tudo num painel simples, sem precisar de técnico.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {STATS.map((s) => (
                <div key={s.label} className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-center backdrop-blur-sm">
                  <p className="text-xl font-black text-orange-500">{s.value}</p>
                  <p className="mt-1 text-xs leading-snug text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Feature cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <article
                  key={f.title}
                  className="flex gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur-sm transition hover:border-orange-200 hover:shadow-sm"
                >
                  <span className="mt-0.5 text-xl">{f.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{f.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{f.desc}</p>
                  </div>
                </article>
              ))}
            </div>

            {/* Social proof */}
            <p className="text-xs text-slate-400">
              Funcionando em restaurantes reais · Sem taxa de adesão · Cancele quando quiser
            </p>
          </section>

          {/* ── RIGHT SIDE · Login form ── */}
          <div className="lg:sticky lg:top-8">
            <section className="surface-card rounded-3xl p-6 sm:p-8">
              <div className="mb-7 text-center">
                <h2 className="text-2xl font-black text-slate-900">Entrar no painel</h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  Use seu e-mail e senha para continuar
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  void handleSubmit(e);
                }}
                className="space-y-5"
              >
                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                    <span className="mt-0.5">⚠️</span>
                    {error}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@restaurante.com"
                    required
                    autoComplete="email"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? "Entrando..." : "Entrar →"}
                </button>
              </form>

              <div className="mt-6 space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">O que você encontra aqui</p>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li className="flex items-center gap-2"><span className="text-orange-400">✓</span> Painel de pedidos em tempo real</li>
                  <li className="flex items-center gap-2"><span className="text-orange-400">✓</span> Cardápio digital com QR Code por mesa</li>
                  <li className="flex items-center gap-2"><span className="text-orange-400">✓</span> Gestão de categorias e produtos</li>
                  <li className="flex items-center gap-2"><span className="text-orange-400">✓</span> Relatórios de vendas por período</li>
                </ul>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4 text-center">
                <Link href="/" className="text-sm font-semibold text-slate-400 transition hover:text-slate-600">
                  ← Voltar para o início
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
