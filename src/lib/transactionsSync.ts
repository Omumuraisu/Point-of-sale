import { TransactionRecord } from './types';
import { isSupabaseConfigured, supabase } from './supabase';
import { getUnsyncedTransactions, updateTransactionSyncState } from '../components/pos/transactionsStore';

interface TransactionSyncResult {
    success: boolean;
    error?: string;
}

const logSyncDebug = (event: string, details?: Record<string, unknown>) => {
    if (!__DEV__) {
        return;
    }

    if (details) {
        console.log(`[SUPABASE_SYNC] ${event}`, details);
        return;
    }

    console.log(`[SUPABASE_SYNC] ${event}`);
};

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return 'Unknown Supabase sync error';
};

const toTransactionRow = (transaction: TransactionRecord) => ({
    id: transaction.id,
    item: transaction.item,
    amount: transaction.amount,
    subtitle: transaction.subtitle,
    category: transaction.category,
    category_type: transaction.categoryType,
    date_label: transaction.dateLabel,
    created_at_ms: transaction.createdAt,
    cart_items: transaction.cartItems ?? [],
    paid_amount: transaction.paidAmount ?? null,
    total_due: transaction.totalDue ?? null,
    synced_at_ms: Date.now(),
});

export const syncTransactionRecordWithResult = async (
    transaction: TransactionRecord,
): Promise<TransactionSyncResult> => {
    if (!isSupabaseConfigured || !supabase) {
        return {
            success: false,
            error: 'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.',
        };
    }

    try {
        const { error } = await supabase
            .from('transactions')
            .upsert(toTransactionRow(transaction), { onConflict: 'id' });

        if (error) {
            return {
                success: false,
                error: error.message,
            };
        }

        logSyncDebug('transaction synced', { transactionId: transaction.id });

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: getErrorMessage(error),
        };
    }
};

export const syncTransactionRecord = async (
    transaction: TransactionRecord,
): Promise<boolean> => {
    const result = await syncTransactionRecordWithResult(transaction);
    return result.success;
};

export const syncUnsyncedTransactions = async (): Promise<{ attempted: number; synced: number }> => {
    if (!isSupabaseConfigured || !supabase) {
        return { attempted: 0, synced: 0 };
    }

    const unsyncedTransactions = await getUnsyncedTransactions();
    let synced = 0;

    for (const transaction of unsyncedTransactions) {
        const result = await syncTransactionRecordWithResult(transaction);
        const nextAttempts = (transaction.syncAttempts ?? 0) + 1;

        if (result.success) {
            synced += 1;
            await updateTransactionSyncState(transaction.id, {
                synced: true,
                syncedAt: Date.now(),
                syncError: undefined,
                syncAttempts: nextAttempts,
            });
        } else {
            await updateTransactionSyncState(transaction.id, {
                synced: false,
                syncError: result.error,
                syncAttempts: nextAttempts,
            });
        }
    }

    logSyncDebug('batch complete', {
        attempted: unsyncedTransactions.length,
        synced,
    });

    return {
        attempted: unsyncedTransactions.length,
        synced,
    };
};
