import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/errorHandler.js";
import { createOrUpdateTransaction, listTransactions, listTransactionSyncStatus } from "../services/transactions.service.js";
import { safeJson } from "../utils/safeJson.js";

const txRouteDebugLog = (event: string, details?: Record<string, unknown>) => {
    if (!env.TX_SYNC_DEBUG) {
        return;
    }

    if (details) {
        console.log(`[TX_SYNC_ROUTE] ${event}`, details);
        return;
    }

    console.log(`[TX_SYNC_ROUTE] ${event}`);
};

const toBigIntOrNull = (value: unknown): bigint | null => {
    if (typeof value === "bigint") {
        return value;
    }

    if (typeof value === "number" && Number.isInteger(value)) {
        return BigInt(value);
    }

    if (typeof value === "string" && /^\d+$/.test(value)) {
        return BigInt(value);
    }

    return null;
};

const createTransactionSchema = z.object({
    ownerId: z.union([z.string(), z.number(), z.bigint()]).optional(),
    owner_id: z.union([z.string(), z.number(), z.bigint()]).optional(),
    externalId: z.string().min(1).optional(),
    external_id: z.string().min(1).optional(),
    saleDatetime: z.string().datetime().optional(),
    sale_datetime: z.string().datetime().optional(),
    totalAmount: z.number().finite().optional(),
    total_amount: z.number().finite().optional(),
    paidAmount: z.number().finite().optional(),
    paid_amount: z.number().finite().optional(),
    cartItems: z.array(
        z.object({
            name: z.string().min(1),
            category: z.string().optional(),
            quantity: z.number().finite().positive(),
            unit: z.string().optional(),
            pricePerKg: z.number().finite().nonnegative().optional(),
            price_per_unit: z.number().finite().nonnegative().optional(),
            total: z.number().finite().nonnegative().optional(),
            line_total: z.number().finite().nonnegative().optional()
        })
    ).optional(),
    cart_items: z.array(
        z.object({
            name: z.string().min(1),
            category: z.string().optional(),
            quantity: z.number().finite().positive(),
            unit: z.string().optional(),
            pricePerKg: z.number().finite().nonnegative().optional(),
            price_per_unit: z.number().finite().nonnegative().optional(),
            total: z.number().finite().nonnegative().optional(),
            line_total: z.number().finite().nonnegative().optional()
        })
    ).optional()
}).transform((value) => ({
    ownerId: toBigIntOrNull(value.ownerId ?? value.owner_id),
    externalId: value.externalId ?? value.external_id ?? "",
    saleDatetime: value.saleDatetime ?? value.sale_datetime ?? "",
    totalAmount: value.totalAmount ?? value.total_amount ?? Number.NaN,
    paidAmount: value.paidAmount ?? value.paid_amount ?? null,
    cartItems: (value.cartItems ?? value.cart_items ?? []).map((item) => {
        const pricePerUnit = item.pricePerKg ?? item.price_per_unit ?? null;
        const lineTotal = item.total ?? item.line_total ?? (
            pricePerUnit !== null
                ? pricePerUnit * item.quantity
                : Number.NaN
        );

        return {
            productName: item.name.trim(),
            category: item.category?.trim() || null,
            quantity: item.quantity,
            unit: item.unit?.trim() || null,
            pricePerUnit,
            lineTotal
        };
    })
})).superRefine((value, ctx) => {
    if (value.ownerId === null || value.ownerId <= 0n) {
        ctx.addIssue({ code: "custom", message: "ownerId is required and must be a positive integer" });
    }

    if (!value.externalId) {
        ctx.addIssue({ code: "custom", message: "externalId is required" });
    }

    if (!value.saleDatetime) {
        ctx.addIssue({ code: "custom", message: "saleDatetime is required" });
    }

    if (!Number.isFinite(value.totalAmount)) {
        ctx.addIssue({ code: "custom", message: "totalAmount is required and must be numeric" });
    }

    if (value.paidAmount !== null && !Number.isFinite(value.paidAmount)) {
        ctx.addIssue({ code: "custom", message: "paidAmount must be numeric when provided" });
    }

    value.cartItems.forEach((item, index) => {
        if (!item.productName) {
            ctx.addIssue({ code: "custom", message: `cartItems[${index}].name is required` });
        }

        if (!Number.isFinite(item.lineTotal) || item.lineTotal < 0) {
            ctx.addIssue({ code: "custom", message: `cartItems[${index}].line_total must be numeric` });
        }
    });
});

const listQuerySchema = z.object({
    ownerId: z.union([z.string(), z.number(), z.bigint()]).optional(),
    owner_id: z.union([z.string(), z.number(), z.bigint()]).optional()
}).transform((value) => ({
    ownerId: toBigIntOrNull(value.ownerId ?? value.owner_id)
}));

export const transactionsRouter = Router();

transactionsRouter.post("/transactions", async (req, res, next) => {
    const requestId = randomUUID().slice(0, 8);
    const startedAt = Date.now();

    try {
        txRouteDebugLog("post:start", {
            requestId,
            ownerId: req.body?.ownerId ?? req.body?.owner_id,
            externalId: req.body?.externalId ?? req.body?.external_id,
        });

        const parsed = createTransactionSchema.safeParse(req.body);
        if (!parsed.success) {
            txRouteDebugLog("post:validation_failed", {
                requestId,
                issues: parsed.error.issues.map((issue) => issue.message),
            });

            for (const issue of parsed.error.issues) {
                console.error(`[transactions.validation] ${issue.message}`);
            }
            throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request body");
        }

        if (parsed.data.ownerId === null) {
            throw new HttpError(400, "ownerId is required and must be a positive integer");
        }

        const created = await createOrUpdateTransaction({
            ownerId: parsed.data.ownerId,
            externalId: parsed.data.externalId,
            saleDatetime: new Date(parsed.data.saleDatetime),
            totalAmount: parsed.data.totalAmount,
            paidAmount: parsed.data.paidAmount,
            cartItems: parsed.data.cartItems,
            requestId
        });

        txRouteDebugLog("post:success", {
            requestId,
            ownerId: parsed.data.ownerId.toString(),
            externalId: parsed.data.externalId,
            itemCount: parsed.data.cartItems.length,
            durationMs: Date.now() - startedAt,
        });

        res.status(201).json(safeJson(created));
    } catch (error) {
        txRouteDebugLog("post:failed", {
            requestId,
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : "Unknown error",
        });

        next(error);
    }
});

transactionsRouter.get("/transactions", async (req, res, next) => {
    try {
        const parsed = listQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            throw new HttpError(400, "Invalid query parameters");
        }

        const transactions = await listTransactions(
            parsed.data.ownerId ?? undefined
        );

        res.json(safeJson(transactions));
    } catch (error) {
        next(error);
    }
});

transactionsRouter.get("/transactions/sync-status", async (req, res, next) => {
    try {
        const parsed = listQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            throw new HttpError(400, "Invalid query parameters");
        }

        const statusRows = await listTransactionSyncStatus(
            parsed.data.ownerId ?? undefined
        );

        res.json(safeJson(statusRows));
    } catch (error) {
        next(error);
    }
});