import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { prisma } from "../../prisma/client.js";
import {
  createMercadoPagoCheckout,
  createOpenPixCharge,
  fetchMercadoPagoPaymentById,
} from "../../utils/payment-gateways.js";

export const restaurantRoutes = Router();

function normalizePublicUrl(rawValue: string | undefined, fallback: string): string {
  const candidate = (rawValue || "").trim();
  if (!candidate) return fallback;

  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) return fallback;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

// Webhooks não usam auth JWT (chamadas server-to-server dos gateways)
restaurantRoutes.post("/billing/webhooks/openpix", async (req, res) => {
  try {
    const payload = req.body as {
      charge?: { correlationID?: string; status?: string };
      correlationID?: string;
      status?: string;
    };

    const correlationID = payload.charge?.correlationID ?? payload.correlationID;
    const status = (payload.charge?.status ?? payload.status ?? "").toLowerCase();

    if (!correlationID || !correlationID.startsWith("invoice-")) {
      return res.status(400).json({ message: "correlationID inválido" });
    }

    if (!["paid", "completed", "active"].includes(status)) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const invoiceId = correlationID.replace("invoice-", "");
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

    if (!invoice) {
      return res.status(404).json({ message: "Fatura não encontrada" });
    }

    if (invoice.status !== "paid") {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "paid",
          paidAt: new Date(),
          method: invoice.method ?? "pix_openpix",
        },
      });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("Erro no webhook OpenPix:", error);
    return res.status(500).json({ message: "Erro no webhook OpenPix" });
  }
});

restaurantRoutes.post("/billing/webhooks/mercadopago", async (req, res) => {
  try {
    const type = (req.body?.type ?? req.query.type) as string | undefined;
    const dataId = (req.body?.data?.id ?? req.query["data.id"]) as string | undefined;

    if (type !== "payment" || !dataId) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const payment = await fetchMercadoPagoPaymentById(dataId);
    const externalReference = (payment.external_reference as string | undefined) ?? null;
    const paymentStatus = ((payment.status as string | undefined) ?? "").toLowerCase();

    if (!externalReference) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: externalReference } });
    if (!invoice) {
      return res.status(404).json({ message: "Fatura não encontrada" });
    }

    if (["approved", "accredited"].includes(paymentStatus) && invoice.status !== "paid") {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "paid",
          paidAt: new Date(),
          method: invoice.method ?? "mercadopago",
        },
      });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("Erro no webhook Mercado Pago:", error);
    return res.status(500).json({ message: "Erro no webhook Mercado Pago" });
  }
});

restaurantRoutes.use(authMiddleware);

restaurantRoutes.get("/profile", async (req, res) => {
  const restaurantId = req.user!.restaurantId;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      name: true,
      slug: true,
      phone: true,
      logoUrl: true,
      coverUrl: true,
      description: true,
      instagram: true,
      whatsapp: true,
      facebook: true,
      customDomain: true,
      createdAt: true,
    },
  });

  if (!restaurant) {
    return res.status(404).json({ message: "Restaurante não encontrado" });
  }

  return res.json(restaurant);
});

restaurantRoutes.put("/profile", async (req, res) => {
  const restaurantId = req.user!.restaurantId;

  const {
    name,
    slug,
    phone,
    logoUrl,
    coverUrl,
    description,
    instagram,
    whatsapp,
    facebook,
    customDomain,
  } = req.body as {
    name?: unknown;
    slug?: unknown;
    phone?: unknown;
    logoUrl?: unknown;
    coverUrl?: unknown;
    description?: unknown;
    instagram?: unknown;
    whatsapp?: unknown;
    facebook?: unknown;
    customDomain?: unknown;
  };

  if (typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({ message: "name é obrigatório (mínimo 2 caracteres)" });
  }

  if (typeof slug !== "string" || !/^[a-z0-9-]{3,50}$/.test(slug)) {
    return res.status(400).json({
      message: "slug inválido (use apenas minúsculas, números e hífen, 3-50 chars)",
    });
  }

  const normalizedCustomDomain =
    typeof customDomain === "string" && customDomain.trim()
      ? customDomain.trim().toLowerCase()
      : null;

  if (
    normalizedCustomDomain &&
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(normalizedCustomDomain)
  ) {
    return res.status(400).json({ message: "customDomain inválido" });
  }

  const existingSlug = await prisma.restaurant.findFirst({
    where: {
      slug,
      id: { not: restaurantId },
    },
    select: { id: true },
  });

  if (existingSlug) {
    return res.status(409).json({ message: "Slug já está em uso" });
  }

  if (normalizedCustomDomain) {
    const existingDomain = await prisma.restaurant.findFirst({
      where: {
        customDomain: normalizedCustomDomain,
        id: { not: restaurantId },
      },
      select: { id: true },
    });

    if (existingDomain) {
      return res.status(409).json({ message: "Domínio já está em uso" });
    }
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      name: name.trim(),
      slug,
      phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
      logoUrl: typeof logoUrl === "string" && logoUrl.trim() ? logoUrl.trim() : null,
      coverUrl: typeof coverUrl === "string" && coverUrl.trim() ? coverUrl.trim() : null,
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      instagram: typeof instagram === "string" && instagram.trim() ? instagram.trim() : null,
      whatsapp: typeof whatsapp === "string" && whatsapp.trim() ? whatsapp.trim() : null,
      facebook: typeof facebook === "string" && facebook.trim() ? facebook.trim() : null,
      customDomain: normalizedCustomDomain,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      phone: true,
      logoUrl: true,
      coverUrl: true,
      description: true,
      instagram: true,
      whatsapp: true,
      facebook: true,
      customDomain: true,
      createdAt: true,
    },
  });

  return res.json(updated);
});

// GET /restaurant/billing - assinatura e faturas do restaurante logado
restaurantRoutes.get("/billing", async (req, res) => {
  const restaurantId = req.user!.restaurantId;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: {
      subscription: true,
    },
  });

  if (!restaurant) {
    return res.status(404).json({ message: "Restaurante não encontrado" });
  }

  const invoices = await prisma.invoice.findMany({
    where: { restaurantId },
    orderBy: { dueDate: "desc" },
  });

  return res.json({
    subscription: restaurant.subscription,
    invoices,
  });
});

// PATCH /restaurant/billing/invoices/:invoiceId/pay - registrar pagamento de fatura
restaurantRoutes.patch("/billing/invoices/:invoiceId/pay", async (req, res) => {
  const restaurantId = req.user!.restaurantId;
  const { invoiceId } = req.params;
  const { method = "manual" } = req.body as { method?: unknown };

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      restaurantId,
    },
  });

  if (!invoice) {
    return res.status(404).json({ message: "Fatura não encontrada" });
  }

  if (invoice.status === "paid") {
    return res.status(400).json({ message: "Fatura já está paga" });
  }

  const paidInvoice = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "paid",
      paidAt: new Date(),
      method: typeof method === "string" && method.trim() ? method.trim() : "manual",
    },
  });

  const pendingOrOverdue = await prisma.invoice.count({
    where: {
      restaurantId,
      status: { in: ["pending", "overdue"] },
    },
  });

  if (pendingOrOverdue === 0) {
    await prisma.subscription.updateMany({
      where: { restaurantId },
      data: { status: "active" },
    });
  }

  return res.json({ message: "Pagamento registrado com sucesso", invoice: paidInvoice });
});

// POST /restaurant/billing/invoices/:invoiceId/payment-intents/pix
restaurantRoutes.post("/billing/invoices/:invoiceId/payment-intents/pix", async (req, res) => {
  const restaurantId = req.user!.restaurantId;
  const { invoiceId } = req.params;

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, restaurantId },
      include: {
        restaurant: {
          select: { name: true },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ message: "Fatura não encontrada" });
    }

    if (invoice.status === "paid") {
      return res.status(400).json({ message: "Fatura já está paga" });
    }

    const appUrl = normalizePublicUrl(process.env.APP_URL, "http://localhost:3000");
    const pixCharge = await createOpenPixCharge({
      invoiceId: invoice.id,
      reference: invoice.reference,
      amount: invoice.amount,
      customerName: invoice.restaurant.name,
      customerEmail: req.user!.email,
      returnUrl: `${appUrl}/dashboard/billing`,
    });

    const notes = invoice.notes ? `${invoice.notes}\n` : "";
    const openPixMeta = {
      provider: "openpix",
      chargeId: pixCharge.providerChargeId,
      generatedAt: new Date().toISOString(),
    };

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        method: "pix_openpix",
        notes: `${notes}${JSON.stringify(openPixMeta)}`,
      },
    });

    return res.json({
      invoiceId: invoice.id,
      amount: invoice.amount,
      qrCodeImage: pixCharge.qrCodeImage,
      brCode: pixCharge.brCode,
      paymentLinkUrl: pixCharge.paymentLinkUrl,
      providerChargeId: pixCharge.providerChargeId,
    });
  } catch (error) {
    console.error("Erro ao gerar cobrança PIX:", error);
    return res.status(500).json({ message: error instanceof Error ? error.message : "Erro ao gerar PIX" });
  }
});

// POST /restaurant/billing/invoices/:invoiceId/payment-intents/card
restaurantRoutes.post("/billing/invoices/:invoiceId/payment-intents/card", async (req, res) => {
  const restaurantId = req.user!.restaurantId;
  const { invoiceId } = req.params;

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, restaurantId },
    });

    if (!invoice) {
      return res.status(404).json({ message: "Fatura não encontrada" });
    }

    if (invoice.status === "paid") {
      return res.status(400).json({ message: "Fatura já está paga" });
    }

    const appUrl = normalizePublicUrl(process.env.APP_URL, "http://localhost:3000");
    const apiUrl = normalizePublicUrl(process.env.PUBLIC_API_URL, "http://localhost:3333");

    const checkout = await createMercadoPagoCheckout({
      invoiceId: invoice.id,
      reference: invoice.reference,
      amount: invoice.amount,
      customerEmail: req.user!.email,
      successUrl: `${appUrl}/dashboard/billing?payment=success`,
      pendingUrl: `${appUrl}/dashboard/billing?payment=pending`,
      failureUrl: `${appUrl}/dashboard/billing?payment=failure`,
      notificationUrl: `${apiUrl}/restaurant/billing/webhooks/mercadopago`,
    });

    const notes = invoice.notes ? `${invoice.notes}\n` : "";
    const mpMeta = {
      provider: "mercadopago",
      preferenceId: checkout.providerReference,
      generatedAt: new Date().toISOString(),
    };

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        method: "mercadopago_checkout",
        notes: `${notes}${JSON.stringify(mpMeta)}`,
      },
    });

    return res.json({
      invoiceId: invoice.id,
      checkoutUrl: checkout.checkoutUrl,
      providerReference: checkout.providerReference,
    });
  } catch (error) {
    console.error("Erro ao iniciar checkout cartão:", error);
    return res.status(500).json({ message: error instanceof Error ? error.message : "Erro ao iniciar checkout" });
  }
});

