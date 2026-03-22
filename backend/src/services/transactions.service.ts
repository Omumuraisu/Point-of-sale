import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";

export type CreateTransactionItemInput = {
    productName: string;
    category?: string | null;
    quantity: number;
    unit?: string | null;
    pricePerUnit?: number | null;
    lineTotal: number;
};

type CreateTransactionInput = {
    ownerId: bigint;
    externalId: string;
    saleDatetime: Date;
    totalAmount: number;
    paidAmount?: number | null;
    cartItems?: CreateTransactionItemInput[];
    requestId?: string;
};

const txServiceDebugLog = (event: string, details?: Record<string, unknown>) => {
    if (!env.TX_SYNC_DEBUG) {
        return;
    }

    if (details) {
        console.log(`[TX_SYNC_SERVICE] ${event}`, details);
        return;
    }

    console.log(`[TX_SYNC_SERVICE] ${event}`);
};

export async function createOrUpdateTransaction(input: CreateTransactionInput) {
    return prisma.$transaction(async (tx) => {
        const existing = await tx.transactions.findFirst({
            where: {
                owner_id: input.ownerId,
                external_id: input.externalId
            }
        });

        // Transactions.owner_id references users.id, so ensure a row exists for offline-first clients.
        await tx.users.upsert({
            where: { id: input.ownerId },
            create: {
                id: input.ownerId,
                name: `Owner ${input.ownerId.toString()}`
            },
            update: {}
        });

        if (existing) {
            txServiceDebugLog("upsert:update", {
                requestId: input.requestId,
                transactionId: existing.transaction_id.toString(),
                ownerId: input.ownerId.toString(),
                externalId: input.externalId,
                itemCount: input.cartItems?.length ?? 0,
            });

            if (input.cartItems && input.cartItems.length > 0) {
                await tx.transaction_items.deleteMany({
                    where: { transaction_id: existing.transaction_id }
                });
            }

            return tx.transactions.update({
                where: { transaction_id: existing.transaction_id },
                data: {
                    sale_datetime: input.saleDatetime,
                    total_amount: input.totalAmount,
                    paid_amount: input.paidAmount ?? null,
                    transaction_items: input.cartItems && input.cartItems.length > 0
                        ? {
                            create: input.cartItems.map((item) => ({
                                product_name: item.productName,
                                category: item.category ?? null,
                                quantity: item.quantity,
                                unit: item.unit ?? null,
                                price_per_unit: item.pricePerUnit ?? null,
                                line_total: item.lineTotal
                            }))
                        }
                        : undefined
                },
                include: {
                    transaction_items: true
                }
            });
        }

        txServiceDebugLog("upsert:create", {
            requestId: input.requestId,
            ownerId: input.ownerId.toString(),
            externalId: input.externalId,
            itemCount: input.cartItems?.length ?? 0,
        });

        return tx.transactions.create({
            data: {
                owner_id: input.ownerId,
                external_id: input.externalId,
                sale_datetime: input.saleDatetime,
                total_amount: input.totalAmount,
                paid_amount: input.paidAmount ?? null,
                transaction_items: input.cartItems && input.cartItems.length > 0
                    ? {
                        create: input.cartItems.map((item) => ({
                            product_name: item.productName,
                            category: item.category ?? null,
                            quantity: item.quantity,
                            unit: item.unit ?? null,
                            price_per_unit: item.pricePerUnit ?? null,
                            line_total: item.lineTotal
                        }))
                    }
                    : undefined
            },
            include: {
                transaction_items: true
            }
        });
    });
}

export async function listTransactions(ownerId?: bigint) {
    return prisma.transactions.findMany({
        where: ownerId ? { owner_id: ownerId } : undefined,
        include: {
            transaction_items: true
        },
        orderBy: {
            sale_datetime: "desc"
        }
    });
}

export async function listTransactionSyncStatus(ownerId?: bigint) {
    const rows = await prisma.transactions.findMany({
        where: ownerId ? { owner_id: ownerId } : undefined,
        select: {
            transaction_id: true,
            external_id: true,
            owner_id: true,
            sale_datetime: true,
            total_amount: true,
            paid_amount: true,
            _count: {
                select: {
                    transaction_items: true
                }
            }
        },
        orderBy: {
            sale_datetime: "desc"
        }
    });

    return rows.map((row) => ({
        transactionId: row.transaction_id,
        externalId: row.external_id,
        ownerId: row.owner_id,
        saleDatetime: row.sale_datetime,
        totalAmount: row.total_amount,
        paidAmount: row.paid_amount,
        itemCount: row._count.transaction_items
    }));
}