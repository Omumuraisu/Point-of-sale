import { getUnsyncedTransactions, updateTransactionSyncState } from '../components/pos/transactionsStore';
import { API_BASE_URL, buildApiUrl, TRANSACTIONS_ENDPOINT, TX_SYNC_DEBUG } from './config';
import { TransactionRecord } from './types';

const DEFAULT_OWNER_ID = 1;
const inFlightTransactionIds = new Set<string>();

const debugSyncLog = (event: string, details?: Record<string, unknown>) => {
    if (!TX_SYNC_DEBUG) {
        return;
    }

    if (details) {
        console.log(`[TX_SYNC_DEBUG] ${event}`, details);
        return;
    }

    console.log(`[TX_SYNC_DEBUG] ${event}`);
};

const parseCurrencyAmount = (value: string): number => {
    const normalized = value.replace(/[^0-9.\-]/g, '');
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : 0;
};

const resolveTotalAmount = (transaction: TransactionRecord): number => {
    if (typeof transaction.totalDue === 'number' && Number.isFinite(transaction.totalDue)) {
        return transaction.totalDue;
    }

    return parseCurrencyAmount(transaction.amount);
};

type TransactionSyncPayload = {
    owner_id: number;
    external_id: string;
    sale_datetime: string;
    total_amount: number;
    paid_amount?: number;
    cart_items?: Array<{
        name: string;
        category: string;
        quantity: number;
        unit: string;
        price_per_unit: number;
        line_total: number;
    }>;
};

const toPayload = (transaction: TransactionRecord, ownerId: number): TransactionSyncPayload => {
    const payload: TransactionSyncPayload = {
        owner_id: ownerId,
        external_id: transaction.id,
        sale_datetime: new Date(transaction.createdAt).toISOString(),
        total_amount: resolveTotalAmount(transaction),
    };

    if (typeof transaction.paidAmount === 'number' && Number.isFinite(transaction.paidAmount)) {
        payload.paid_amount = transaction.paidAmount;
    }

    if (Array.isArray(transaction.cartItems) && transaction.cartItems.length > 0) {
        payload.cart_items = transaction.cartItems
            .filter((item) => item.name.trim().length > 0 && Number.isFinite(item.quantity) && Number.isFinite(item.total))
            .map((item) => ({
                name: item.name.trim(),
                category: item.category.trim(),
                quantity: item.quantity,
                unit: item.unit,
                price_per_unit: item.pricePerKg,
                line_total: item.total,
            }));
    }

    return payload;
};

const validatePayload = (payload: TransactionSyncPayload): void => {
    if (!payload.external_id.trim()) {
        throw new Error('Sync payload missing external_id');
    }

    if (!Number.isFinite(payload.total_amount) || payload.total_amount <= 0) {
        throw new Error('Sync payload has invalid total_amount');
    }

    if (Number.isNaN(new Date(payload.sale_datetime).getTime())) {
        throw new Error('Sync payload has invalid sale_datetime');
    }
};

const postTransaction = async (transaction: TransactionRecord, ownerId: number): Promise<void> => {
    const payload = toPayload(transaction, ownerId);
    validatePayload(payload);

    debugSyncLog('post:start', {
        transactionId: transaction.id,
        ownerId,
        externalId: payload.external_id,
        totalAmount: payload.total_amount,
        itemCount: payload.cart_items?.length ?? 0,
        apiBaseUrl: API_BASE_URL,
    });

    const response = await fetch(buildApiUrl(TRANSACTIONS_ENDPOINT), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const responseText = await response.text();

        if (__DEV__) {
            console.error('[TRANSACTIONS_DEBUG] Sync failed payload:', payload);
        }

        throw new Error(`Sync failed (${response.status}): ${responseText}`);
    }

    debugSyncLog('post:success', {
        transactionId: transaction.id,
        status: response.status,
    });
};

const classifySyncReason = (message: string): 'network' | 'validation' | 'server' | 'unknown' => {
    const lower = message.toLowerCase();

    if (lower.includes('network request failed')) {
        return 'network';
    }

    const statusMatch = message.match(/sync failed \((\d{3})\)/i);
    const status = statusMatch ? Number(statusMatch[1]) : NaN;

    if (Number.isFinite(status)) {
        if (status >= 400 && status < 500) {
            return 'validation';
        }

        if (status >= 500) {
            return 'server';
        }
    }

    return 'unknown';
};

const toSyncErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        const message = error.message || 'Unknown sync error';
        const reason = classifySyncReason(message);

        if (message.toLowerCase().includes('network request failed')) {
            return `[${reason}] Network request failed. Cannot reach API at ${API_BASE_URL}. `
                + 'If using a physical Android device, set EXPO_PUBLIC_ANDROID_DEVICE_API_BASE_URL to your PC LAN IP.';
        }

        return `[${reason}] ${message}`;
    }

    return '[unknown] Unknown sync error';
};

export const syncTransactionRecord = async (
    transaction: TransactionRecord,
    ownerId = DEFAULT_OWNER_ID,
): Promise<boolean> => {
    if (transaction.synced) {
        return true;
    }

    if (inFlightTransactionIds.has(transaction.id)) {
        return false;
    }

    inFlightTransactionIds.add(transaction.id);
    const startedAt = Date.now();

    const attempts = (transaction.syncAttempts ?? 0) + 1;

    debugSyncLog('record:start', {
        transactionId: transaction.id,
        ownerId,
        attempts,
        inFlightCount: inFlightTransactionIds.size,
    });

    await updateTransactionSyncState(transaction.id, {
        synced: false,
        syncAttempts: attempts,
        syncError: undefined,
        syncedAt: transaction.syncedAt,
    });

    try {
        await postTransaction(transaction, ownerId);

        await updateTransactionSyncState(transaction.id, {
            synced: true,
            syncAttempts: attempts,
            syncError: undefined,
            syncedAt: Date.now(),
        });

        debugSyncLog('record:success', {
            transactionId: transaction.id,
            attempts,
            durationMs: Date.now() - startedAt,
        });

        return true;
    } catch (error) {
        const syncErrorMessage = toSyncErrorMessage(error);

        if (__DEV__) {
            console.error('[TRANSACTIONS_DEBUG] Sync transaction failed:', transaction.id, syncErrorMessage, error);
        }

        await updateTransactionSyncState(transaction.id, {
            synced: false,
            syncAttempts: attempts,
            syncError: syncErrorMessage,
            syncedAt: transaction.syncedAt,
        });

        debugSyncLog('record:failed', {
            transactionId: transaction.id,
            attempts,
            durationMs: Date.now() - startedAt,
            syncError: syncErrorMessage,
        });

        return false;
    } finally {
        inFlightTransactionIds.delete(transaction.id);
    }
};

export const syncUnsyncedTransactions = async (
    ownerId = DEFAULT_OWNER_ID,
    maxBatchSize = 10,
): Promise<{ attempted: number; synced: number }> => {
    const startedAt = Date.now();
    const unsynced = await getUnsyncedTransactions();
    const batch = unsynced.slice(0, Math.max(1, Math.floor(maxBatchSize)));

    debugSyncLog('batch:start', {
        ownerId,
        maxBatchSize,
        unsyncedCount: unsynced.length,
        batchSize: batch.length,
        transactionIds: batch.map((transaction) => transaction.id),
        apiBaseUrl: API_BASE_URL,
    });

    let synced = 0;

    for (const transaction of batch) {
        const didSync = await syncTransactionRecord(transaction, ownerId);

        if (didSync) {
            synced += 1;
        }
    }

    debugSyncLog('batch:end', {
        ownerId,
        attempted: batch.length,
        synced,
        failed: batch.length - synced,
        durationMs: Date.now() - startedAt,
    });

    return {
        attempted: batch.length,
        synced,
    };
};
