import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem, SaveReceiptTransactionInput, TransactionRecord } from '../../lib/types';
import { isTransactionRecord, toTransaction } from '../../lib/utils';

const SALES_TRANSACTIONS_KEY = '@pos/sales-transactions';
const SALES_TRANSACTIONS_FALLBACK_KEY = 'pos-sales-transactions';
const MAX_SAVED_TRANSACTIONS = 100;
const DEV_SEED_FLAG_KEY = '@pos/dev-seeded-transactions-v1';

const withSyncDefaults = (transaction: TransactionRecord): TransactionRecord => ({
    ...transaction,
    synced: transaction.synced ?? false,
    syncAttempts: transaction.syncAttempts ?? 0,
});

const trimTransactions = (transactions: TransactionRecord[]): TransactionRecord[] => {
    if (transactions.length <= MAX_SAVED_TRANSACTIONS) {
        return transactions;
    }

    const unsynced = transactions.filter((transaction) => !transaction.synced);
    const synced = transactions.filter((transaction) => transaction.synced);

    return [...unsynced, ...synced].slice(0, MAX_SAVED_TRANSACTIONS);
};

const saveTransactions = async (transactions: TransactionRecord[]): Promise<boolean> => {
    const normalized = trimTransactions(transactions.map(withSyncDefaults));

    try {
        await AsyncStorage.setItem(SALES_TRANSACTIONS_KEY, JSON.stringify(normalized));
        return true;
    } catch (primaryError) {
        if (__DEV__) {
            console.error('[TRANSACTIONS_DEBUG] Primary transaction save failed, trying fallback key:', primaryError);
        }

        try {
            await AsyncStorage.setItem(SALES_TRANSACTIONS_FALLBACK_KEY, JSON.stringify(normalized));
            return true;
        } catch (fallbackError) {
            if (__DEV__) {
                console.error('[TRANSACTIONS_DEBUG] Fallback transaction save failed:', fallbackError);
            }

            return false;
        }
    }
};

export const loadSavedTransactions = async (): Promise<TransactionRecord[]> => {
    try {
        const raw = await AsyncStorage.getItem(SALES_TRANSACTIONS_KEY)
            ?? await AsyncStorage.getItem(SALES_TRANSACTIONS_FALLBACK_KEY);

        if (!raw) {
            return [];
        }

        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        // Keep only records that satisfy the strict typed shape.
        return parsed.filter(isTransactionRecord).map(withSyncDefaults);
    } catch (error) {
        if (__DEV__) {
            console.error('[TRANSACTIONS_DEBUG] Failed to load saved transactions:', error);
        }

        return [];
    }
};

export const saveReceiptTransaction = async ({ cartItems, paidAmount, totalDue }: SaveReceiptTransactionInput): Promise<TransactionRecord | null> => {
    if (cartItems.length === 0) {
        return null;
    }

    const createdAt = Date.now();
    const transaction = withSyncDefaults(toTransaction({
        cartItems,
        paidAmount,
        totalDue,
        createdAt,
    }));

    const existing = await loadSavedTransactions();
    const updated = [transaction, ...existing];

    const didSave = await saveTransactions(updated);

    if (!didSave) {
        return null;
    }

    try {
        const { syncTransactionRecordWithResult } = await import('../../lib/transactionsSync');
        const result = await syncTransactionRecordWithResult(transaction);
        const syncAttempts = (transaction.syncAttempts ?? 0) + 1;

        if (result.success) {
            const syncedAt = Date.now();

            await updateTransactionSyncState(transaction.id, {
                synced: true,
                syncedAt,
                syncError: undefined,
                syncAttempts,
            });

            return {
                ...transaction,
                synced: true,
                syncedAt,
                syncError: undefined,
                syncAttempts,
            };
        }

        await updateTransactionSyncState(transaction.id, {
            synced: false,
            syncError: result.error,
            syncAttempts,
        });

        return {
            ...transaction,
            synced: false,
            syncError: result.error,
            syncAttempts,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to start Supabase transaction sync';
        const syncAttempts = (transaction.syncAttempts ?? 0) + 1;

        await updateTransactionSyncState(transaction.id, {
            synced: false,
            syncError: message,
            syncAttempts,
        });

        return {
            ...transaction,
            synced: false,
            syncError: message,
            syncAttempts,
        };
    }
};

export const updateTransactionSyncState = async (
    transactionId: string,
    patch: Pick<TransactionRecord, 'synced' | 'syncedAt' | 'syncError' | 'syncAttempts'>,
): Promise<void> => {
    const existing = await loadSavedTransactions();
    const index = existing.findIndex((transaction) => transaction.id === transactionId);

    if (index < 0) {
        return;
    }

    const current = existing[index];
    const updatedTransaction: TransactionRecord = withSyncDefaults({
        ...current,
        ...patch,
    });

    const updated = [...existing];
    updated[index] = updatedTransaction;
    await saveTransactions(updated);
};

export const getUnsyncedTransactions = async (): Promise<TransactionRecord[]> => {
    const transactions = await loadSavedTransactions();

    return transactions.filter((transaction) => !transaction.synced);
};

const buildSampleCartItems = (seedOffset: number): CartItem[] => {
    const baseTime = Date.now() - seedOffset * 60_000;

    return [
        {
            id: `seed-item-${seedOffset}-1`,
            name: 'Chicken Breast',
            category: 'Meat',
            quantity: 1.5,
            unit: 'kg',
            pricePerKg: 190,
            total: 285,
            createdAt: baseTime,
        },
        {
            id: `seed-item-${seedOffset}-2`,
            name: 'Rice',
            category: 'Dry Goods',
            quantity: 2,
            unit: 'kg',
            pricePerKg: 58,
            total: 116,
            createdAt: baseTime + 1,
        },
    ];
};

export const seedPrebuiltTransactionsIfEmpty = async (count = 3): Promise<TransactionRecord[]> => {
    const existing = await loadSavedTransactions();

    if (existing.length > 0) {
        return existing;
    }

    const totalToSeed = Math.max(1, Math.floor(count));

    for (let index = 0; index < totalToSeed; index += 1) {
        const cartItems = buildSampleCartItems(index);
        const totalDue = cartItems.reduce((sum, item) => sum + item.total, 0);
        const paidAmount = totalDue + 100;

        await saveReceiptTransaction({
            cartItems,
            totalDue,
            paidAmount,
        });
    }

    return loadSavedTransactions();
};

export const seedDevTransactionsOnce = async (count = 3): Promise<void> => {
    if (!__DEV__) {
        return;
    }

    try {
        const existing = await loadSavedTransactions();

        if (existing.length > 0) {
            await AsyncStorage.setItem(DEV_SEED_FLAG_KEY, '1');
            return;
        }

        const alreadySeeded = await AsyncStorage.getItem(DEV_SEED_FLAG_KEY);

        if (alreadySeeded) {
            // If the seed flag exists but transaction storage is empty, reseed once.
            await AsyncStorage.removeItem(DEV_SEED_FLAG_KEY);
        }

        const seeded = await seedPrebuiltTransactionsIfEmpty(count);

        if (seeded.length > 0) {
            await AsyncStorage.setItem(DEV_SEED_FLAG_KEY, '1');
        }
    } catch {
        // Ignore seed failures to avoid blocking startup in development.
    }
};
