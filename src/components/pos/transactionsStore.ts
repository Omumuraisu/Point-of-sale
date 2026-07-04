import AsyncStorage from '@react-native-async-storage/async-storage';
import { SaveReceiptTransactionInput, TransactionRecord } from '../../lib/types';
import { isTransactionRecord, toTransaction } from '../../lib/utils';

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

export const loadSavedTransactions = async (accountId?: number): Promise<TransactionRecord[]> => {
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
        return parsed
            .filter(isTransactionRecord)
            .map(withSyncDefaults)
            .filter((transaction) => transaction.accountId === undefined || transaction.accountId === accountId);
    } catch (error) {
        if (__DEV__) {
            console.error('[TRANSACTIONS_DEBUG] Failed to load saved transactions:', error);
        }

        return [];
    }
};

export const saveReceiptTransaction = async (input: SaveReceiptTransactionInput): Promise<TransactionRecord | null> => {
    const { cartItems, paidAmount, totalDue, accountId } = input;

    if (cartItems.length === 0) {
        return null;
    }

    const createdAt = Date.now();
    const transaction = withSyncDefaults(toTransaction({
        ...input,
        createdAt,
    }));

    const existing = await loadSavedTransactions(transaction.accountId);
    const updated = [transaction, ...existing];

    const didSave = await saveTransactions(transaction.accountId ?? 0, updated);

    if (!didSave) {
        return null;
    }

    try {
        const { syncTransactionRecordWithResult } = await import('../../lib/transactionsSync');
        const result = await syncTransactionRecordWithResult(transaction);
        const syncAttempts = (transaction.syncAttempts ?? 0) + 1;

        if (result.success) {
            const syncedAt = Date.now();

            await updateTransactionSyncState(accountId, transaction.id, {
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

        await updateTransactionSyncState(accountId, transaction.id, {
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

        await updateTransactionSyncState(accountId, transaction.id, {
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
