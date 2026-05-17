import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type PaymentGatewayConfig = {
  openpix: {
    appId: string;
    baseUrl: string;
    chargePath: string;
  };
  mercadopago: {
    clientId: string;
    clientSecret: string;
    baseUrl: string;
  };
  updatedAt: string;
};

type PaymentGatewayConfigPatch = {
  openpix?: Partial<PaymentGatewayConfig["openpix"]>;
  mercadopago?: Partial<PaymentGatewayConfig["mercadopago"]>;
};

const configDir = path.join(process.cwd(), "data");
const configFilePath = path.join(configDir, "payment-gateway-config.json");

function buildDefaultConfig(): PaymentGatewayConfig {
  return {
    openpix: {
      appId: process.env.OPENPIX_APP_ID ?? "",
      baseUrl: process.env.OPENPIX_BASE_URL ?? "https://api.openpix.com.br",
      chargePath: process.env.OPENPIX_CHARGE_PATH ?? "/api/v1/charge",
    },
    mercadopago: {
      clientId: process.env.MP_CLIENT_ID ?? "",
      clientSecret: process.env.MP_CLIENT_SECRET ?? "",
      baseUrl: process.env.MP_BASE_URL ?? "https://api.mercadopago.com",
    },
    updatedAt: new Date(0).toISOString(),
  };
}

export async function readPaymentGatewayConfig(): Promise<PaymentGatewayConfig> {
  const defaults = buildDefaultConfig();

  try {
    const raw = await readFile(configFilePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PaymentGatewayConfig>;

    return {
      openpix: {
        appId: parsed.openpix?.appId ?? defaults.openpix.appId,
        baseUrl: parsed.openpix?.baseUrl ?? defaults.openpix.baseUrl,
        chargePath: parsed.openpix?.chargePath ?? defaults.openpix.chargePath,
      },
      mercadopago: {
        clientId: parsed.mercadopago?.clientId ?? defaults.mercadopago.clientId,
        clientSecret: parsed.mercadopago?.clientSecret ?? defaults.mercadopago.clientSecret,
        baseUrl: parsed.mercadopago?.baseUrl ?? defaults.mercadopago.baseUrl,
      },
      updatedAt: parsed.updatedAt ?? defaults.updatedAt,
    };
  } catch {
    return defaults;
  }
}

export async function writePaymentGatewayConfig(
  patch: PaymentGatewayConfigPatch
): Promise<PaymentGatewayConfig> {
  const current = await readPaymentGatewayConfig();
  const next: PaymentGatewayConfig = {
    openpix: {
      appId: patch.openpix?.appId ?? current.openpix.appId,
      baseUrl: patch.openpix?.baseUrl ?? current.openpix.baseUrl,
      chargePath: patch.openpix?.chargePath ?? current.openpix.chargePath,
    },
    mercadopago: {
      clientId: patch.mercadopago?.clientId ?? current.mercadopago.clientId,
      clientSecret: patch.mercadopago?.clientSecret ?? current.mercadopago.clientSecret,
      baseUrl: patch.mercadopago?.baseUrl ?? current.mercadopago.baseUrl,
    },
    updatedAt: new Date().toISOString(),
  };

  await mkdir(configDir, { recursive: true });
  await writeFile(configFilePath, JSON.stringify(next, null, 2), "utf-8");

  return next;
}

export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 6) return "******";
  return `${secret.slice(0, 3)}***${secret.slice(-3)}`;
}
