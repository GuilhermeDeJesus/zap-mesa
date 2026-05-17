import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

type BillingAutomationTrigger = "scheduler" | "manual";
const BILLING_LOCK_KEY_1 = 81_027;
const BILLING_LOCK_KEY_2 = 44_901;

export type BillingAutomationHistoryEntry = {
  id: string;
  createdAt: string;
  finishedAt: string;
  trigger: BillingAutomationTrigger;
  actorEmail?: string;
  ok: boolean;
  durationMs: number;
  stats: {
    subscriptionsChecked: number;
    invoicesCreated: number;
    invoicesMarkedOverdue: number;
    subscriptionsActivated: number;
    subscriptionsPastDue: number;
    skippedWithFutureBilling: number;
    skippedWithoutNextBillingAt: number;
    duplicateReferencesIgnored: number;
  };
  message: string;
  error?: string;
};

export type BillingAutomationRunResult = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  trigger: BillingAutomationTrigger;
  actorEmail?: string;
  durationMs: number;
  stats: BillingAutomationHistoryEntry["stats"];
  message: string;
  skipped?: boolean;
};

export type BillingCompetenceReprocessResult = {
  runId: string;
  reference: string;
  startedAt: string;
  finishedAt: string;
  actorEmail?: string;
  durationMs: number;
  subscriptionsChecked: number;
  invoicesCreated: number;
  existingInvoices: number;
  message: string;
  skipped?: boolean;
};

const dataDir = path.join(process.cwd(), "data");
const historyFilePath = path.join(dataDir, "billing-automation-history.json");
const maxHistoryItems = 300;

let activeRun: Promise<BillingAutomationRunResult> | null = null;
let schedulerHandle: NodeJS.Timeout | null = null;
let nextSchedulerRunAt: string | null = null;

type DbClient = Prisma.TransactionClient;

async function readRawHistory(): Promise<BillingAutomationHistoryEntry[]> {
  try {
    const raw = await readFile(historyFilePath, "utf-8");
    const parsed = JSON.parse(raw) as BillingAutomationHistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

async function appendHistory(entry: BillingAutomationHistoryEntry): Promise<void> {
  const current = await readRawHistory();
  const next = [entry, ...current].slice(0, maxHistoryItems);
  await mkdir(dataDir, { recursive: true });
  await writeFile(historyFilePath, JSON.stringify(next, null, 2), "utf-8");
}

export async function readBillingAutomationHistory(): Promise<BillingAutomationHistoryEntry[]> {
  const history = await readRawHistory();
  return history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function monthReference(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addMonthsUTC(date: Date, months: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
}

function nextDailyDelayMs(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(2, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return Math.max(60_000, next.getTime() - now.getTime());
}

function parseCompetenceDate(reference: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(reference.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;

  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

async function withBillingAutomationLock<T>(
  handler: (tx: DbClient) => Promise<T>
): Promise<{ acquired: boolean; data?: T }> {
  return prisma.$transaction(
    async (tx) => {
      const lockRows = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(
          CAST(${BILLING_LOCK_KEY_1} AS int4),
          CAST(${BILLING_LOCK_KEY_2} AS int4)
        ) AS locked
      `;

      if (!lockRows[0]?.locked) {
        return { acquired: false };
      }

      const data = await handler(tx);
      return { acquired: true, data };
    },
    {
      maxWait: 10_000,
      timeout: 120_000,
    }
  );
}

async function evaluateSubscriptionForAutomation(
  tx: DbClient,
  subscription: {
  id: string;
  restaurantId: string;
  status: "trial" | "active" | "past_due" | "suspended" | "canceled";
  price: number;
  nextBillingAt: Date | null;
  currentPeriodStart: Date | null;
  autoRenew: boolean;
  interval: "monthly";
  restaurant: { slug: string };
}
) {
  const now = new Date();
  const todayStart = startOfUTCDay(now);

  const result = {
    invoiceCreated: false,
    markedOverdueCount: 0,
    turnedPastDue: false,
    turnedActive: false,
    skippedWithFutureBilling: false,
    skippedWithoutNextBillingAt: false,
    duplicateReferenceIgnored: false,
  };

  if (!subscription.nextBillingAt) {
    result.skippedWithoutNextBillingAt = true;
  } else if (subscription.nextBillingAt.getTime() > now.getTime()) {
    result.skippedWithFutureBilling = true;
  } else {
    const cycleStart = subscription.nextBillingAt;
    const reference = `${subscription.restaurant.slug}-${monthReference(cycleStart)}`;

    const existingInvoice = await tx.invoice.findFirst({
      where: {
        restaurantId: subscription.restaurantId,
        reference,
      },
      select: { id: true },
    });

    if (!existingInvoice) {
      try {
        await tx.invoice.create({
          data: {
            restaurantId: subscription.restaurantId,
            subscriptionId: subscription.id,
            reference,
            amount: subscription.price,
            dueDate: cycleStart,
            status: "pending",
            method: null,
            notes: JSON.stringify({
              source: "automation",
              createdAt: new Date().toISOString(),
            }),
          },
        });

        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart: cycleStart,
            currentPeriodEnd: addMonthsUTC(cycleStart, 1),
            nextBillingAt: addMonthsUTC(cycleStart, 1),
          },
        });

        result.invoiceCreated = true;
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "P2002"
        ) {
          result.duplicateReferenceIgnored = true;
        } else {
          throw error;
        }
      }
    }
  }

  const overdueUpdate = await tx.invoice.updateMany({
    where: {
      restaurantId: subscription.restaurantId,
      status: "pending",
      dueDate: { lt: todayStart },
    },
    data: {
      status: "overdue",
    },
  });

  result.markedOverdueCount = overdueUpdate.count;

  const openInvoicesCount = await tx.invoice.count({
    where: {
      restaurantId: subscription.restaurantId,
      status: { in: ["pending", "overdue"] },
    },
  });

  if (openInvoicesCount > 0 && subscription.status !== "past_due") {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { status: "past_due" },
    });
    result.turnedPastDue = true;
  }

  if (openInvoicesCount === 0 && subscription.status === "past_due") {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { status: "active" },
    });
    result.turnedActive = true;
  }

  return result;
}

export async function runBillingAutomation(params?: {
  trigger?: BillingAutomationTrigger;
  actorEmail?: string;
}): Promise<BillingAutomationRunResult> {
  if (activeRun) return activeRun;

  const trigger = params?.trigger ?? "scheduler";
  const actorEmail = params?.actorEmail;

  activeRun = (async () => {
    const startedAtDate = new Date();
    const startedAt = startedAtDate.toISOString();
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const stats: BillingAutomationHistoryEntry["stats"] = {
      subscriptionsChecked: 0,
      invoicesCreated: 0,
      invoicesMarkedOverdue: 0,
      subscriptionsActivated: 0,
      subscriptionsPastDue: 0,
      skippedWithFutureBilling: 0,
      skippedWithoutNextBillingAt: 0,
      duplicateReferencesIgnored: 0,
    };

    try {
      const lockExecution = await withBillingAutomationLock(async (tx) => {
        const subscriptions = await tx.subscription.findMany({
          where: {
            autoRenew: true,
            status: { in: ["trial", "active", "past_due"] },
            interval: "monthly",
          },
          include: {
            restaurant: {
              select: { slug: true },
            },
          },
        });

        for (const subscription of subscriptions) {
          stats.subscriptionsChecked += 1;
          const subResult = await evaluateSubscriptionForAutomation(tx, subscription);

          if (subResult.invoiceCreated) stats.invoicesCreated += 1;
          if (subResult.markedOverdueCount > 0) {
            stats.invoicesMarkedOverdue += subResult.markedOverdueCount;
          }
          if (subResult.turnedActive) stats.subscriptionsActivated += 1;
          if (subResult.turnedPastDue) stats.subscriptionsPastDue += 1;
          if (subResult.skippedWithFutureBilling) stats.skippedWithFutureBilling += 1;
          if (subResult.skippedWithoutNextBillingAt) stats.skippedWithoutNextBillingAt += 1;
          if (subResult.duplicateReferenceIgnored) stats.duplicateReferencesIgnored += 1;
        }
      });

      const finishedAtDate = new Date();
      const finishedAt = finishedAtDate.toISOString();
      const durationMs = finishedAtDate.getTime() - startedAtDate.getTime();
      const lockAcquired = lockExecution.acquired;
      const message = lockAcquired
        ? "Execução de billing concluída com sucesso"
        : "Execução ignorada porque outra instância já está processando billing";

      await appendHistory({
        id: runId,
        createdAt: startedAt,
        finishedAt,
        trigger,
        actorEmail,
        ok: true,
        durationMs,
        stats,
        message,
      });

      return {
        runId,
        startedAt,
        finishedAt,
        trigger,
        actorEmail,
        durationMs,
        stats,
        message,
        skipped: !lockAcquired,
      };
    } catch (error) {
      const finishedAtDate = new Date();
      const finishedAt = finishedAtDate.toISOString();
      const durationMs = finishedAtDate.getTime() - startedAtDate.getTime();
      const message = "Falha na execução de billing";
      const errorMessage = error instanceof Error ? error.message : String(error);

      await appendHistory({
        id: runId,
        createdAt: startedAt,
        finishedAt,
        trigger,
        actorEmail,
        ok: false,
        durationMs,
        stats,
        message,
        error: errorMessage,
      });

      throw error;
    } finally {
      activeRun = null;
    }
  })();

  return activeRun;
}

export async function reprocessBillingCompetence(params: {
  reference: string;
  actorEmail?: string;
}): Promise<BillingCompetenceReprocessResult> {
  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();
  const runId = `reprocess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const normalizedReference = params.reference.trim();
  const competenceDate = parseCompetenceDate(normalizedReference);
  if (!competenceDate) {
    throw new Error("reference inválida. Use AAAA-MM");
  }

  let subscriptionsChecked = 0;
  let invoicesCreated = 0;
  let existingInvoices = 0;

  const lockExecution = await withBillingAutomationLock(async (tx) => {
    const subscriptions = await tx.subscription.findMany({
      where: {
        autoRenew: true,
        status: { in: ["trial", "active", "past_due"] },
        interval: "monthly",
      },
      include: {
        restaurant: {
          select: { slug: true },
        },
      },
    });

    for (const subscription of subscriptions) {
      subscriptionsChecked += 1;
      const reference = `${subscription.restaurant.slug}-${normalizedReference}`;

      const existing = await tx.invoice.findFirst({
        where: {
          restaurantId: subscription.restaurantId,
          reference,
        },
        select: { id: true },
      });

      if (existing) {
        existingInvoices += 1;
        continue;
      }

      try {
        await tx.invoice.create({
          data: {
            restaurantId: subscription.restaurantId,
            subscriptionId: subscription.id,
            reference,
            amount: subscription.price,
            dueDate: competenceDate,
            status: "pending",
            method: null,
            notes: JSON.stringify({
              source: "automation_reprocess",
              reference: normalizedReference,
              createdAt: new Date().toISOString(),
            }),
          },
        });

        invoicesCreated += 1;
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "P2002"
        ) {
          existingInvoices += 1;
        } else {
          throw error;
        }
      }

      const openInvoices = await tx.invoice.count({
        where: {
          restaurantId: subscription.restaurantId,
          status: { in: ["pending", "overdue"] },
        },
      });

      if (openInvoices > 0 && subscription.status !== "past_due") {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: "past_due" },
        });
      }
    }
  });

  const finishedAtDate = new Date();
  const finishedAt = finishedAtDate.toISOString();
  const durationMs = finishedAtDate.getTime() - startedAtDate.getTime();
  const lockAcquired = lockExecution.acquired;
  const message = lockAcquired
    ? "Reprocessamento de competência concluído"
    : "Reprocessamento ignorado porque outra instância já está processando billing";

  return {
    runId,
    reference: normalizedReference,
    startedAt,
    finishedAt,
    actorEmail: params.actorEmail,
    durationMs,
    subscriptionsChecked,
    invoicesCreated,
    existingInvoices,
    message,
    skipped: !lockAcquired,
  };
}

export function getBillingAutomationStatus() {
  return {
    running: Boolean(activeRun),
    schedulerEnabled: Boolean(schedulerHandle),
    nextRunAt: nextSchedulerRunAt,
  };
}

function scheduleNextTick() {
  const delayMs = nextDailyDelayMs();
  const nextRunDate = new Date(Date.now() + delayMs);
  nextSchedulerRunAt = nextRunDate.toISOString();

  schedulerHandle = setTimeout(async () => {
    try {
      await runBillingAutomation({ trigger: "scheduler" });
    } catch (error) {
      console.error("Erro na automação de billing:", error);
    } finally {
      nextSchedulerRunAt = null;
      scheduleNextTick();
    }
  }, delayMs);
}

export function startBillingAutomationScheduler() {
  if (schedulerHandle) return;
  scheduleNextTick();
}
