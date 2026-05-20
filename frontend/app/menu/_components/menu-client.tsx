"use client";

import { useEffect, useRef, useState } from "react";

import type { MenuData, Product } from "../../../types";
import { formatBRL } from "../../../utils/formatBRL";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

interface CartItem {
  product: Product;
  quantity: number;
  notes: string;
}

export function MenuClient({
  mode,
  tableNumber,
  slug,
}: {
  mode: "slug" | "host";
  tableNumber: number;
  slug?: string;
}) {
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const menuUrl = mode === "host" ? `${API_URL}/menu/tenant/host` : `${API_URL}/menu/${slug}`;
        const res = await fetch(menuUrl);
        if (!res.ok) {
          setError(
            mode === "host"
              ? "Restaurante não encontrado para este domínio."
              : "Cardápio não encontrado.",
          );
          return;
        }
        const data = (await res.json()) as MenuData;
        setMenu(data);
      } catch {
        setError("Não foi possível carregar o cardápio.");
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, slug]);

  // Intersection observer para destacar categoria ativa na nav
  useEffect(() => {
    if (!menu) return;
    const observers: IntersectionObserver[] = [];

    menu.categories.forEach((cat) => {
      const el = categoryRefs.current[cat.id];
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveCategory(cat.id);
        },
        { rootMargin: "-30% 0px -65% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [menu]);

  // Scroll horizontal da nav para o item ativo
  useEffect(() => {
    if (!activeCategory || !navRef.current) return;
    const btn = navRef.current.querySelector<HTMLButtonElement>(`[data-cat="${activeCategory}"]`);
    btn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeCategory]);

  function scrollToCategory(catId: string) {
    const el = categoryRefs.current[catId];
    if (!el) return;
    const offset = 120;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [...prev, { product, quantity: 1, notes: "" }];
    });
    setCartOpen(true);
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.product.id === productId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0),
    );
  }

  function updateNotes(productId: string, notes: string) {
    setCart((prev) => prev.map((c) => (c.product.id === productId ? { ...c, notes } : c)));
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.product.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  async function submitOrder() {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const submitUrl =
        mode === "host" ? `${API_URL}/menu/tenant/host/orders` : `${API_URL}/menu/${slug}/orders`;

      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber,
          items: cart.map((c) => ({
            productId: c.product.id,
            quantity: c.quantity,
            notes: c.notes || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string; error?: string };
        throw new Error(err.message ?? err.error ?? "Erro ao enviar pedido");
      }
      setCart([]);
      setCartOpen(false);
      setSuccess(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro ao enviar pedido");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f2ea]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f2ea]">
        <p className="text-red-500">{error || "Cardápio indisponível"}</p>
      </div>
    );
  }

  if (success) {
    // Tempo estimado mock (poderia vir do backend futuramente)
    const tempo = 20 + Math.floor(Math.random() * 10); // 20-29 min
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f6f2ea] text-center px-4">
        <div className="mb-4 animate-bounce-slow">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="32" fill="#FDE68A" />
            <path d="M32 18v20" stroke="#F59E42" strokeWidth="4" strokeLinecap="round" />
            <circle cx="32" cy="44" r="2.5" fill="#F59E42" />
          </svg>
        </div>
        <h2 className="text-2xl font-black text-gray-800 mb-2">Pedido enviado!</h2>
        <p className="text-gray-500 text-sm mb-2">
          Mesa {tableNumber} · {menu.restaurant.name}
        </p>
        <p className="text-orange-600 text-base font-semibold mb-4">
          Tempo estimado de preparo: <span className="font-black">{tempo} min</span>
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Você pode acompanhar o status com o garçom ou fazer um novo pedido a qualquer momento.<br />
          Obrigado por escolher <span className="font-bold">{menu.restaurant.name}</span>! 🍽️
        </p>
        <button
          onClick={() => setSuccess(false)}
          className="bg-orange-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 shadow"
        >
          Fazer novo pedido
        </button>
      </div>
    );
  }

  const { restaurant } = menu;
  const activeCats = menu.categories.filter((c) => (c.products ?? []).some((p) => p.active));

  const whatsappUrl = restaurant.whatsapp
    ? `https://wa.me/${restaurant.whatsapp.replace(/\D/g, "")}`
    : null;
  const instagramUrl = restaurant.instagram
    ? `https://instagram.com/${restaurant.instagram.replace(/^@/, "")}`
    : null;
  const facebookUrl = restaurant.facebook
    ? `https://facebook.com/${restaurant.facebook}`
    : null;

  return (
    <div className="bg-[#f5f1e8] min-h-screen pb-32 text-slate-900">

      {/* ── TOPO RICO CENTRALIZADO ────────────────────────────── */}
      <div className="relative w-full bg-slate-800">
        <div className="h-32 sm:h-44 md:h-56 w-full overflow-hidden">
          {restaurant.coverUrl ? (
            <img
              src={restaurant.coverUrl}
              alt={`${restaurant.name} capa`}
              className="w-full h-full object-cover opacity-70"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-700 to-orange-900/60" />
          )}
          <div className="absolute inset-0 h-44 md:h-56 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        </div>
        <div className="absolute top-0 left-0 w-full h-full flex items-end justify-center pointer-events-none">
          <div className="relative w-full max-w-3xl px-4 pb-4 flex items-end gap-4 pointer-events-auto">
            {restaurant.logoUrl && (
              <img
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl object-cover border-2 border-white shadow-xl shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-2xl font-black text-white leading-tight drop-shadow">
                {restaurant.name}
              </h1>
              {restaurant.description && (
                <p className="text-xs text-white/80 mt-0.5 line-clamp-2">{restaurant.description}</p>
              )}
            </div>
            {/* Badge mesa — canto superior direito, mas dentro do container */}
            <div className="absolute top-0 right-0 bg-black/40 backdrop-blur-sm text-white rounded-full px-2.5 py-1 text-xs font-semibold mt-2 mr-2 sm:mt-3 sm:mr-3">
              Mesa {tableNumber}
            </div>
          </div>
        </div>
      </div>

      {/* ── BARRA DE INFO / REDES SOCIAIS CENTRALIZADA ────────── */}
      <div className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-2 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 flex-wrap">
          {restaurant.phone && (
            <a
              href={`tel:${restaurant.phone}`}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-orange-600 transition"
            >
              <PhoneIcon />
              {restaurant.phone}
            </a>
          )}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 rounded-full px-3 py-1.5 transition"
            >
              <WhatsAppIcon />
              WhatsApp
            </a>
          )}
          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-pink-700 hover:text-pink-800 bg-pink-50 hover:bg-pink-100 rounded-full px-3 py-1.5 transition"
            >
              <InstagramIcon />
              {restaurant.instagram?.startsWith("@") ? restaurant.instagram : `@${restaurant.instagram}`}
            </a>
          )}
          {facebookUrl && (
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-full px-3 py-1.5 transition"
            >
              <FacebookIcon />
              Facebook
            </a>
          )}
          <span className="ml-auto text-xs text-slate-400">
            {activeCats.reduce((s, c) => s + (c.products ?? []).filter((p) => p.active).length, 0)} itens
          </span>
        </div>
      </div>

      {/* ── NAV DE CATEGORIAS STICKY ──────────────────────────── */}
      {activeCats.length > 0 && (
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
          <div className="max-w-3xl mx-auto px-2 sm:px-4">
            <div
              ref={navRef}
              className="flex gap-1 overflow-x-auto no-scrollbar py-1.5 sm:py-2"
              style={{ scrollbarWidth: "none" }}
            >
              {activeCats.map((cat) => (
                <button
                  key={cat.id}
                  data-cat={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className={`shrink-0 px-3 sm:px-4 py-1.5 rounded-full text-sm font-semibold transition whitespace-nowrap ${
                    activeCategory === cat.id
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-slate-600 hover:bg-orange-50 hover:text-orange-600"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── LISTA DE CATEGORIAS / PRODUTOS ───────────────────── */}
      <div className="max-w-3xl mx-auto px-2 sm:px-4 pt-4 sm:pt-6 space-y-6 sm:space-y-10">
        {activeCats.map((cat) => {
          const activeProducts = (cat.products ?? []).filter((p) => p.active);
          if (activeProducts.length === 0) return null;
          return (
            <section
              key={cat.id}
              ref={(el) => { categoryRefs.current[cat.id] = el; }}
            >
              <div className="flex items-end justify-between mb-2 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-black text-gray-900">{cat.name}</h2>
                <span className="text-xs text-gray-400">
                  {activeProducts.length} {activeProducts.length === 1 ? "item" : "itens"}
                </span>
              </div>
              <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
                {activeProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={addToCart}
                    cartQty={cart.find((c) => c.product.id === product.id)?.quantity ?? 0}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* ── BOTÃO FLUTUANTE DO CARRINHO ───────────────────────── */}
      {cartCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-orange-500 text-white pl-4 pr-5 py-3 rounded-full shadow-xl flex items-center gap-3 text-base font-semibold z-40 hover:bg-orange-600 transition active:scale-95"
          style={{ minWidth: 220 }}
        >
          <span className="bg-white text-orange-500 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
            {cartCount}
          </span>
          Mandar pedido · {formatBRL(cartTotal)}
        </button>
      )}

      {/* ── DRAWER CARRINHO ───────────────────────────────────── */}
      {cartOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-t-3xl p-4 sm:p-5 max-h-[82vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-orange-500 font-semibold">Carrinho</p>
                <h2 className="text-lg font-black text-slate-900">Seu pedido</h2>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="h-10 w-10 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-2xl leading-none flex items-center justify-center"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {cart.map((item) => (
                <div key={item.product.id} className="border border-slate-100 rounded-2xl p-3 sm:p-4 bg-slate-50/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.product.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatBRL(item.product.price)} cada</p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      Remover
                    </button>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 mt-2 sm:mt-3">
                    <div className="flex items-center gap-1 border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <button onClick={() => updateQty(item.product.id, -1)} className="px-3 py-2 text-lg text-slate-500 hover:bg-slate-100">−</button>
                      <span className="text-base px-2 font-semibold text-slate-700">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product.id, +1)} className="px-3 py-2 text-lg text-slate-500 hover:bg-slate-100">+</button>
                    </div>
                    <span className="text-sm text-slate-500 ml-auto font-medium">
                      {formatBRL(item.product.price * item.quantity)}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => updateNotes(item.product.id, e.target.value)}
                    placeholder="Observação (opcional)"
                    className="mt-2 sm:mt-3 w-full text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
              <p className="font-semibold text-slate-800">Total: {formatBRL(cartTotal)}</p>
            </div>

            <button
              disabled={submitting}
              onClick={() => { void submitOrder(); }}
              className="mt-4 w-full bg-orange-500 text-white rounded-2xl py-3 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition shadow-sm"
            >
              {submitting ? "Enviando..." : "Confirmar pedido"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PRODUCT CARD ──────────────────────────────────────────────────────────────
function ProductCard({
  product,
  onAdd,
  cartQty,
}: {
  product: Product;
  onAdd: (p: Product) => void;
  cartQty: number;
}) {
  return (
    <div className="group bg-white rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3 sm:gap-5 p-3 sm:p-4 hover:shadow-md transition-shadow">
      {/* imagem grande, borda laranja, sombra, sem fundo sólido */}
      <div className="w-20 h-20 sm:w-[112px] sm:h-[112px] shrink-0 relative flex items-center justify-center">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover rounded-2xl border-4 border-orange-400 shadow-lg group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-2xl sm:text-4xl bg-orange-50 rounded-2xl border-4 border-orange-200">🍽️</div>
        )}
        {cartQty > 0 && (
          <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow">
            {cartQty}
          </div>
        )}
      </div>

      {/* info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <p className="text-base sm:text-lg font-bold text-gray-900 leading-snug line-clamp-2">{product.name}</p>
          {product.description && (
            <div className="mt-1 sm:mt-2 rounded-xl border border-orange-100 bg-orange-50/70 px-2 sm:px-3 py-1.5 sm:py-2">
              <p className="text-xs sm:text-sm font-medium text-slate-700 leading-relaxed">
                {product.description}
              </p>
            </div>
          )}
        </div>
        <div className="mt-2 sm:mt-3 flex items-center justify-between">
          <p className="text-base sm:text-lg font-black text-orange-600">{formatBRL(product.price)}</p>
          <button
            onClick={() => onAdd(product)}
            className="bg-orange-500 text-white text-xl w-10 h-10 rounded-full flex items-center justify-center hover:bg-orange-600 active:scale-95 transition shadow-sm"
            style={{ minWidth: 40, minHeight: 40 }}
            aria-label="Adicionar ao carrinho"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ÍCONES INLINE (sem dependência externa) ────────────────────────────────────
function PhoneIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.28a2 2 0 011.898 1.368l.867 2.6a2 2 0 01-.45 2.05L8.1 10.4a11.04 11.04 0 005.5 5.5l1.382-1.494a2 2 0 012.05-.45l2.6.867A2 2 0 0121 16.72V19a2 2 0 01-2 2h-1C9.163 21 3 14.837 3 7V6a2 2 0 012-2z" />
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
