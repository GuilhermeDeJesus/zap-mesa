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

export default function LoginPage() {
  const router = useRouter();
  const { login, token, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ffedd5_0%,#f8fafc_32%,#eaf2ff_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">ZapMesa Platform</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
              Operacao mais inteligente para restaurantes
            </h1>
            <p className="mt-4 max-w-xl text-base text-slate-600">
              Uma entrada unica para dono da plataforma e gestores de loja, com experiencias especificas para cada perfil.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <article className="surface-card rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dono da plataforma</p>
              <p className="mt-2 text-sm text-slate-700">Acesso ao painel global, analytics e gerenciamento de restaurantes.</p>
            </article>
            <article className="surface-card rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gestor de restaurante</p>
              <p className="mt-2 text-sm text-slate-700">Acesso ao painel operacional da propria loja com pedidos e cardapio.</p>
            </article>
          </div>
        </section>

        <section className="surface-card rounded-3xl p-6 sm:p-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-black text-slate-900">Entrar no painel</h2>
            <p className="mt-1 text-sm text-slate-500">Use seu email e senha para continuar</p>
          </div>

          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="space-y-5"
          >
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              {submitting ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <Link href="/" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
              Voltar para inicio
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
