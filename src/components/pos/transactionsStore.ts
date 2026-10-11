import AsyncStorage from '@react-native-async-storage/async-storage';
import { SaveReceiptTransactionInput, TransactionRecord, TransactionScope } from '../../lib/types';
import { formatCurrency, formatTransactionDate, isTransactionRecord, toTransaction } from '../../lib/utils';
import { debugError, debugWarn } from '../../lib/debugLogging';
import { notifyTransactionSyncChanged } from '../../lib/transactionSyncEvents';

const SALES_TRANSACTIONS_KEY = '@pos/sales-transactions';
const SALES_TRANSACTIONS_FALLBACK_KEY = 'pos-sales-transactions';
const MAX_SAVED_TRANSACTIONS = 100;

const getScopedTransactionsKey = ({ accountId, businessId, stallNumber }: TransactionScope) => (
    `${SALES_TRANSACTIONS_KEY}:v3:${accountId}:${businessId}:${stallNumber}`
);
const getScopedFallbackTransactionsKey = ({ accountId, businessId, stallNumber }: TransactionScope) => (
    `${SALES_TRANSACTIONS_FALLBACK_KEY}:v3:${accountId}:${businessId}:${stallNumber}`
);
const getV2TransactionsKey = ({ accountId, businessId }: TransactionScope) => `${SALES_TRANSACTIONS_KEY}:${accountId}:${businessId}`;
const getV2FallbackTransactionsKey = ({ accountId, businessId }: TransactionScope) => `${SALES_TRANSACTIONS_FALLBACK_KEY}:${accountId}:${businessId}`;
const getLegacyAccountTransactionsKey = (accountId: number) => `${SALES_TRANSACTIONS_KEY}:${accountId}`;
const getLegacyAccountFallbackTransactionsKey = (accountId: number) => `${SALES_TRANSACTIONS_FALLBACK_KEY}:${accountId}`;

const isValidScope = (scope?: TransactionScope | null): scope is TransactionScope => Boolean(
    scope
    && Number.isInteger(scope.accountId)
    && scope.accountId > 0
    && Number.isInteger(scope.businessId)
    && scope.businessId > 0
    && typeof scope.stallNumber === 'string'
    && scope.stallNumber.trim().length > 0
);

const withSyncDefaults = (transaction: TransactionRecord): TransactionRecord => ({
    ...transaction,
    synced: transaction.synced ?? false,
    syncAttempts: transaction.syncAttempts ?? 0,
});

const trimTransactions = (transactions: TransactionRecord[]): TransactionRecord[] => {
    const unsynced = transactions.filter((transaction) => !transaction.synced);
    const synced = transactions.filter((transaction) => transaction.synced);
    return [
        ...unsynced,
        ...synced.slice(0, Math.max(MAX_SAVED_TRANSACTIONS - unsynced.length, 0)),
    ];
};

const saveTransactions = async (scope: TransactionScope, transactions: TransactionRecord[]): Promise<boolean> => {
    const normalized = trimTransactions(transactions.map(withSyncDefaults));

    try {
        await AsyncStorage.setItem(getScopedTransactionsKey(scope), JSON.stringify(normalized));
        return true;
    } catch (primaryError) {
        debugWarn('transactions-payments', 'primary transaction save failed; trying fallback', { error: primaryError });

        try {
            await AsyncStorage.setItem(getScopedFallbackTransactionsKey(scope), JSON.stringify(normalized));
            return true;
        } catch (fallbackError) {
            debugError('transactions-payments', 'fallback transaction save failed', { error: fallbackError });

            return false;
        }
    }
};

export const loadSavedTransactions = async (
    scope?: TransactionScope | null,
): Promise<TransactionRecord[]> => {
    if (!isValidScope(scope)) {
        debugError('transactions-payments', 'cannot load local sales without a valid account and business scope', { scope });
        return [];
    }

    try {
        let raw = await AsyncStorage.getItem(getScopedTransactionsKey(scope))
            ?? await AsyncStorage.getItem(getScopedFallbackTransactionsKey(scope));
        let importedLegacyRecords = false;

        if (!raw) {
            raw = await AsyncStorage.getItem(getV2TransactionsKey(scope))
                ?? await AsyncStorage.getItem(getV2FallbackTransactionsKey(scope));
            importedLegacyRecords = Boolean(raw);
        }

        if (!raw) {
            raw = await AsyncStorage.getItem(getLegacyAccountTransactionsKey(scope.accountId))
                ?? await AsyncStorage.getItem(getLegacyAccountFallbackTransactionsKey(scope.accountId));
            importedLegacyRecords = Boolean(raw);
        }

        if (!raw) {
            return [];
        }

        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        const scopedTransactions = parsed
            .filter(isTransactionRecord)
            .map(withSyncDefaults)
            .filter((transaction) => (
                transaction.accountId === scope.accountId
                && transaction.businessId === scope.businessId
                && transaction.stallNumber === scope.stallNumber
            ));

        if (importedLegacyRecords && scopedTransactions.length > 0) {
            await saveTransactions(scope, scopedTransactions);
        }

        return scopedTransactions;
    } catch (error) {
        debugError('transactions-payments', 'failed to load saved transactions', { error });

        return [];
    }
};

export interface SaveReceiptTransactionResult {
    transaction: TransactionRecord | null;
    error?: string;
}

export const saveReceiptTransaction = async (input: SaveReceiptTransactionInput): Promise<SaveReceiptTransactionResult> => {
    const { cartItems } = input;

    const scope: TransactionScope = {
        accountId: input.accountId,
        businessId: input.businessId,
        stallNumber: input.stallNumber ?? '',
    };

    if (!isValidScope(scope)) {
        return { transaction: null, error: 'Cannot record or synchronize a sale without a valid businessId.' };
    }

    if (cartItems.length === 0 || cartItems.some((item) => !Number.isFinite(item.pricePerUnit) || item.pricePerUnit <= 0)) {
        return { transaction: null, error: 'The cart contains an item without a valid selling price.' };
    }

    const createdAt = Date.now();
    const transaction: TransactionRecord = withSyncDefaults(toTransaction({
        ...input,
        createdAt,
    }));

    const existing = await loadSavedTransactions(scope);
    const existingAttempt = existing.find((item) => item.clientOrderKey === transaction.clientOrderKey);
    const queuedTransaction = existingAttempt ?? transaction;
    const initiallySaved = await saveTransactions(scope, [
        queuedTransaction,
        ...existing.filter((item) => item.id !== queuedTransaction.id && item.clientOrderKey !== queuedTransaction.clientOrderKey),
    ]);

    if (!initiallySaved) {
        return { transaction: null, error: 'Unable to save this sale locally for synchronization.' };
    }

    notifyTransactionSyncChanged();

    try {
        const { syncTransactionRecordWithResult } = await import('../../lib/transactionsSync');
        const result = await syncTransactionRecordWithResult(queuedTransaction, scope);
        const syncAttempts = (queuedTransaction.syncAttempts ?? 0) + 1;

        if (result.success && result.order) {
            const syncedAt = Date.now();
            const itemCount = queuedTransaction.cartItems?.length ?? 0;
            const syncedTransaction: TransactionRecord = {
                ...queuedTransaction,
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
            const latest = await loadSavedTransactions(scope);
            await saveTransactions(scope, [syncedTransaction, ...latest.filter((item) => (
                item.id !== queuedTransaction.id && item.clientOrderKey !== queuedTransaction.clientOrderKey
            ))]);
            notifyTransactionSyncChanged();

            return { transaction: syncedTransaction };
        }

        const unsyncedTransaction: TransactionRecord = {
            ...queuedTransaction,
            synced: false,
            syncError: result.error ?? 'Unable to synchronize this sale.',
            syncAttempts,
        };
        const latest = await loadSavedTransactions(scope);
        const saved = await saveTransactions(scope, [unsyncedTransaction, ...latest.filter((item) => item.id !== queuedTransaction.id)]);

        if (!saved) {
            return { transaction: null, error: 'Unable to save this sale locally for synchronization.' };
        }

        notifyTransactionSyncChanged();
        return { transaction: unsyncedTransaction, error: unsyncedTransaction.syncError };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to start Supabase transaction sync';
        const unsyncedTransaction: TransactionRecord = {
            ...queuedTransaction,
            synced: false,
            syncError: message,
            syncAttempts: (queuedTransaction.syncAttempts ?? 0) + 1,
        };
        const latest = await loadSavedTransactions(scope);
        const saved = await saveTransactions(scope, [unsyncedTransaction, ...latest.filter((item) => item.id !== queuedTransaction.id)]);
        notifyTransactionSyncChanged();
        return saved
            ? { transaction: unsyncedTransaction, error: message }
            : { transaction: null, error: 'Unable to save this sale locally for synchronization.' };
    }
};

export const updateTransactionSyncState = async (
    scope: TransactionScope,
    transactionId: string,
    patch: Partial<Pick<TransactionRecord,
        'id' | 'orderId' | 'createdAt' | 'completedAt' | 'dateLabel' | 'amount' | 'subtitle'
        | 'totalDue' | 'paidAmount' | 'changeAmount' | 'synced' | 'syncedAt' | 'syncError' | 'syncAttempts'>>,
): Promise<void> => {
    const existing = await loadSavedTransactions(scope);
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
    await saveTransactions(scope, updated);
};

export const getUnsyncedTransactions = async (scope: TransactionScope): Promise<TransactionRecord[]> => {
    const transactions = await loadSavedTransactions(scope);

    return transactions.filter((transaction) => !transaction.synced);
};

export const reconcileUnsyncedTransactionListingIds = async (
    scope: TransactionScope,
    aliases: Record<string, string>,
): Promise<void> => {
    const transactions = await loadSavedTransactions(scope);
    const updated = transactions.map((transaction) => transaction.synced ? transaction : ({
        ...transaction,
        cartItems: transaction.cartItems?.map((item) => ({
            ...item,
            productListingId: aliases[item.productListingId] ?? item.productListingId,
        })),
    }));
    await saveTransactions(scope, updated);
};
