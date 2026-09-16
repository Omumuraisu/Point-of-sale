import AsyncStorage from '@react-native-async-storage/async-storage';
import { SaveReceiptTransactionInput, TransactionRecord } from '../../lib/types';
import { formatCurrency, formatTransactionDate, isTransactionRecord, toTransaction } from '../../lib/utils';

const SALES_TRANSACTIONS_KEY = '@pos/sales-transactions';
const SALES_TRANSACTIONS_FALLBACK_KEY = 'pos-sales-transactions';
const MAX_SAVED_TRANSACTIONS = 100;

const getAccountTransactionsKey = (accountId: number) => `${SALES_TRANSACTIONS_KEY}:${accountId}`;
const getAccountFallbackTransactionsKey = (accountId: number) => `${SALES_TRANSACTIONS_FALLBACK_KEY}:${accountId}`;

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

const saveTransactions = async (accountId: number, transactions: TransactionRecord[]): Promise<boolean> => {
    const normalized = trimTransactions(transactions.map(withSyncDefaults));

    try {
        await AsyncStorage.setItem(getAccountTransactionsKey(accountId), JSON.stringify(normalized));
        return true;
    } catch (primaryError) {
        if (__DEV__) {
            console.error('[TRANSACTIONS_DEBUG] Primary transaction save failed, trying fallback key:', primaryError);
        }

        try {
            await AsyncStorage.setItem(getAccountFallbackTransactionsKey(accountId), JSON.stringify(normalized));
            return true;
        } catch (fallbackError) {
            if (__DEV__) {
                console.error('[TRANSACTIONS_DEBUG] Fallback transaction save failed:', fallbackError);
            }

            return false;
        }
    }
};

export const loadSavedTransactions = async (
    accountId?: number,
    stallId?: string | null,
    stallNumber?: string | null,
): Promise<TransactionRecord[]> => {
    if (!accountId) {
        return [];
    }

    try {
        const raw = await AsyncStorage.getItem(getAccountTransactionsKey(accountId))
            ?? await AsyncStorage.getItem(getAccountFallbackTransactionsKey(accountId));

        if (!raw) {
            return [];
        }

        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        // Keep only records that satisfy the strict typed shape.
        const stallScope = [stallId, stallNumber].filter((value): value is string => Boolean(value));

        return parsed
            .filter(isTransactionRecord)
            .map(withSyncDefaults)
            .filter((transaction) => transaction.accountId === undefined || transaction.accountId === accountId)
            .filter((transaction) => {
                if (stallScope.length === 0) {
                    return true;
                }

                return [transaction.stallId, transaction.stallNumber]
                    .some((value) => value != null && stallScope.includes(value));
            });
    } catch (error) {
        if (__DEV__) {
            console.error('[TRANSACTIONS_DEBUG] Failed to load saved transactions:', error);
        }

        return [];
    }
};

export interface SaveReceiptTransactionResult {
    transaction: TransactionRecord | null;
    error?: string;
}

export const saveReceiptTransaction = async (input: SaveReceiptTransactionInput): Promise<SaveReceiptTransactionResult> => {
    const { cartItems } = input;

    if (cartItems.length === 0 || cartItems.some((item) => !Number.isFinite(item.pricePerUnit) || item.pricePerUnit <= 0)) {
        return { transaction: null, error: 'The cart contains an item without a valid selling price.' };
    }

    const createdAt = Date.now();
    const transaction = withSyncDefaults(toTransaction({
        ...input,
        createdAt,
    }));

    try {
        const { syncTransactionRecordWithResult } = await import('../../lib/transactionsSync');
        const result = await syncTransactionRecordWithResult(transaction);
        const syncAttempts = (transaction.syncAttempts ?? 0) + 1;

        if (result.success && result.order) {
            const syncedAt = Date.now();
            const itemCount = transaction.cartItems?.length ?? 0;
            const syncedTransaction: TransactionRecord = {
                ...transaction,
                id: `#${result.order.orderId}`,
                orderId: result.order.orderId,
                createdAt: result.order.completedAt,
                completedAt: result.order.completedAt,
                dateLabel: formatTransactionDate(result.order.completedAt),
                amount: formatCurrency(result.order.totalDue),
                subtitle: `${itemCount} item${itemCount === 1 ? '' : 's'} • Paid ${formatCurrency(result.order.paidAmount)}`,
                totalDue: result.order.totalDue,
                paidAmount: result.order.paidAmount,
                changeAmount: result.order.changeAmount,
                synced: true,
                syncedAt,
                syncError: undefined,
                syncAttempts,
            };
            const existing = await loadSavedTransactions(transaction.accountId);
            await saveTransactions(transaction.accountId ?? 0, [syncedTransaction, ...existing]);
            const { notifyTransactionSyncChanged } = await import('../../lib/transactionSyncEvents');
            notifyTransactionSyncChanged();

            return { transaction: syncedTransaction };
        }

        return { transaction: null, error: result.error ?? 'Unable to record the sale. Please try again.' };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to start Supabase transaction sync';
        return { transaction: null, error: message };
    }
};

export const updateTransactionSyncState = async (
    accountId: number,
    transactionId: string,
    patch: Pick<TransactionRecord, 'synced' | 'syncedAt' | 'syncError' | 'syncAttempts'>,
): Promise<void> => {
    const existing = await loadSavedTransactions(accountId);
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
    await saveTransactions(accountId, updated);
};

export const getUnsyncedTransactions = async (accountId: number): Promise<TransactionRecord[]> => {
    const transactions = await loadSavedTransactions(accountId);

    return transactions.filter((transaction) => !transaction.synced);
};

export const reconcileUnsyncedTransactionListingIds = async (
    accountId: number,
    aliases: Record<string, string>,
): Promise<void> => {
    const transactions = await loadSavedTransactions(accountId);
    const updated = transactions.map((transaction) => transaction.synced ? transaction : ({
        ...transaction,
        cartItems: transaction.cartItems?.map((item) => ({
            ...item,
            productListingId: aliases[item.productListingId] ?? item.productListingId,
        })),
    }));
    await saveTransactions(accountId, updated);
};
