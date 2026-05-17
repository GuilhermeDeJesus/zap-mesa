import { readPaymentGatewayConfig } from "./payment-config-store.js";

type OpenPixConfig = {
  appId: string;
  baseUrl: string;
  chargePath: string;
};

type MercadoPagoConfig = {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
};

type OpenPixChargeResult = {
  provider: "openpix";
  providerChargeId: string | null;
  brCode: string | null;
  qrCodeImage: string | null;
  paymentLinkUrl: string | null;
  raw: unknown;
};

type MercadoPagoCheckoutResult = {
  provider: "mercadopago";
  checkoutUrl: string;
  providerReference: string | null;
  raw: unknown;
};

async function getOpenPixConfig(): Promise<OpenPixConfig> {
  const config = await readPaymentGatewayConfig();
  const appId = config.openpix.appId;
  const baseUrl = config.openpix.baseUrl;
  const chargePath = config.openpix.chargePath;

  if (!appId) {
    throw new Error("OPENPIX_APP_ID não configurado");
  }

  return { appId, baseUrl, chargePath };
}

async function getMercadoPagoConfig(): Promise<MercadoPagoConfig> {
  const config = await readPaymentGatewayConfig();
  const clientId = config.mercadopago.clientId;
  const clientSecret = config.mercadopago.clientSecret;
  const baseUrl = config.mercadopago.baseUrl;

  if (!clientId || !clientSecret) {
    throw new Error("MP_CLIENT_ID/MP_CLIENT_SECRET não configurados");
  }

  return { clientId, clientSecret, baseUrl };
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asAbsoluteUrlOrNull(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function createOpenPixCharge(params: {
  invoiceId: string;
  reference: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  returnUrl?: string;
}): Promise<OpenPixChargeResult> {
  const config = await getOpenPixConfig();

  const body = {
    correlationID: `invoice-${params.invoiceId}`,
    value: Math.round(params.amount * 100),
    comment: `Mensalidade ZapMesa ${params.reference}`,
    customer: {
      name: params.customerName,
      email: params.customerEmail,
    },
    ...(params.returnUrl ? { returnUrl: params.returnUrl } : {}),
  };

  const url = `${config.baseUrl}${config.chargePath}?return_existing=true`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: config.appId,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      pickString(payload.message) || pickString(payload.error) || `Erro OpenPix (${response.status})`;
    throw new Error(message);
  }

  const charge = (payload.charge as Record<string, unknown> | undefined) ?? payload;

  return {
    provider: "openpix",
    providerChargeId:
      pickString(charge.identifier) || pickString(charge.correlationID) || pickString(charge.id),
    brCode:
      pickString(charge.brCode) ||
      pickString((charge.pixQrCode as Record<string, unknown> | undefined)?.brCode),
    qrCodeImage:
      pickString(charge.qrCodeImage) ||
      pickString((charge.pixQrCode as Record<string, unknown> | undefined)?.image) ||
      pickString((charge.pixQrCode as Record<string, unknown> | undefined)?.qrCodeImage),
    paymentLinkUrl: pickString(charge.paymentLinkUrl) || pickString(charge.checkoutUrl),
    raw: payload,
  };
}

async function getMercadoPagoAccessToken(config: MercadoPagoConfig): Promise<string> {
  const response = await fetch(`${config.baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      pickString(payload.message) || pickString(payload.error) || `Erro auth Mercado Pago (${response.status})`;
    throw new Error(message);
  }

  const accessToken = pickString(payload.access_token);
  if (!accessToken) {
    throw new Error("Mercado Pago não retornou access_token");
  }

  return accessToken;
}

export async function createMercadoPagoCheckout(params: {
  invoiceId: string;
  reference: string;
  amount: number;
  customerEmail: string;
  successUrl?: string;
  pendingUrl?: string;
  failureUrl?: string;
  notificationUrl?: string;
}): Promise<MercadoPagoCheckoutResult> {
  const config = await getMercadoPagoConfig();
  const accessToken = await getMercadoPagoAccessToken(config);

  const successUrl = asAbsoluteUrlOrNull(params.successUrl);
  const pendingUrl = asAbsoluteUrlOrNull(params.pendingUrl);
  const failureUrl = asAbsoluteUrlOrNull(params.failureUrl);
  const notificationUrl = asAbsoluteUrlOrNull(params.notificationUrl);

  if (!successUrl) {
    throw new Error("URL de retorno inválida para Mercado Pago (successUrl)");
  }

  const backUrls: Record<string, string> = {
    success: successUrl,
  };
  if (pendingUrl) backUrls.pending = pendingUrl;
  if (failureUrl) backUrls.failure = failureUrl;
  const enableAutoReturn = successUrl.startsWith("https://");

  const response = await fetch(`${config.baseUrl}/checkout/preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      external_reference: params.invoiceId,
      payer: {
        email: params.customerEmail,
      },
      items: [
        {
          id: params.invoiceId,
          title: `Mensalidade ZapMesa ${params.reference}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(params.amount.toFixed(2)),
        },
      ],
      back_urls: backUrls,
      ...(enableAutoReturn ? { auto_return: "approved" } : {}),
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      pickString(payload.message) || pickString(payload.error) || `Erro checkout Mercado Pago (${response.status})`;
    throw new Error(message);
  }

  const checkoutUrl = pickString(payload.init_point) || pickString(payload.sandbox_init_point);
  if (!checkoutUrl) {
    throw new Error("Mercado Pago não retornou URL de checkout");
  }

  return {
    provider: "mercadopago",
    checkoutUrl,
    providerReference: pickString(payload.id),
    raw: payload,
  };
}

export async function fetchMercadoPagoPaymentById(paymentId: string): Promise<Record<string, unknown>> {
  const config = await getMercadoPagoConfig();
  const accessToken = await getMercadoPagoAccessToken(config);

  const response = await fetch(`${config.baseUrl}/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      pickString(payload.message) || pickString(payload.error) || `Erro consulta pagamento MP (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export async function testOpenPixConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const config = await getOpenPixConfig();
    const correlationID = "zapmesa-healthcheck-openpix";

    const response = await fetch(
      `${config.baseUrl}${config.chargePath}?return_existing=true`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: config.appId,
        },
        body: JSON.stringify({
          correlationID,
          value: 1,
          comment: "ZapMesa Healthcheck OpenPix",
          customer: {
            name: "ZapMesa Healthcheck",
            email: "healthcheck@zapmesa.local",
          },
        }),
      }
    );

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const message =
        pickString(payload.message) ||
        pickString(payload.error) ||
        `OpenPix respondeu status ${response.status}`;
      return { ok: false, message };
    }

    return { ok: true, message: "Conexão com OpenPix validada com sucesso" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Falha ao conectar na OpenPix",
    };
  }
}

export async function testMercadoPagoConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const config = await getMercadoPagoConfig();
    await getMercadoPagoAccessToken(config);
    return { ok: true, message: "Conexão com Mercado Pago validada com sucesso" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Falha ao conectar no Mercado Pago",
    };
  }
}
