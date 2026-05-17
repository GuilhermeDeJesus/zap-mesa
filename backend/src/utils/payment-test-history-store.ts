import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type PaymentGatewayName = "openpix" | "mercadopago";

export type PaymentTestHistoryEntry = {
  id: string;
  type: "connection_test" | "webhook_simulation";
  gateway: PaymentGatewayName;
  ok: boolean;
  message: string;
  createdAt: string;
  actorEmail?: string;
  metadata?: Record<string, unknown>;
};

const dataDir = path.join(process.cwd(), "data");
const historyFilePath = path.join(dataDir, "payment-gateway-test-history.json");
const MAX_HISTORY_ITEMS = 200;

async function readRawHistory(): Promise<PaymentTestHistoryEntry[]> {
  try {
    const raw = await readFile(historyFilePath, "utf-8");
    const parsed = JSON.parse(raw) as PaymentTestHistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function readPaymentTestHistory(): Promise<PaymentTestHistoryEntry[]> {
  const history = await readRawHistory();
  return history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function appendPaymentTestHistory(
  entry: Omit<PaymentTestHistoryEntry, "id" | "createdAt">
): Promise<PaymentTestHistoryEntry> {
  const current = await readRawHistory();

  const nextEntry: PaymentTestHistoryEntry = {
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    ...entry,
  };

  const next = [nextEntry, ...current].slice(0, MAX_HISTORY_ITEMS);

  await mkdir(dataDir, { recursive: true });
  await writeFile(historyFilePath, JSON.stringify(next, null, 2), "utf-8");

  return nextEntry;
}

export async function clearPaymentTestHistory(): Promise<void> {
  try {
    await unlink(historyFilePath);
  } catch {
    // se não existir arquivo, já está limpo
  }
}
