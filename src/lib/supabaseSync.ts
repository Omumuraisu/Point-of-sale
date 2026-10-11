import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncUnsyncedTransactions } from './transactionsSync';
import { ProductScope, getListingIdAliases, getProductSyncSummary, syncProducts as syncScopedProducts } from '../components/pos/productsStore';
import { reconcileCartListingIds } from '../components/pos/cartStore';
import { getUnsyncedTransactions, reconcileUnsyncedTransactionListingIds } from '../components/pos/transactionsStore';
import { debugLog } from './debugLogging';
import { TransactionScope } from './types';

interface BatchSyncResult {
    attempted: number;
    synced: number;
    failed?: number;
    error?: string;
}

export interface DatabaseSyncStatus {
    pending: number;
    queued: number;
    failed: number;
    syncing: boolean;
    lastSyncedAt: number | null;
    lastError?: string;
    sales: { queued: number; failed: number };
    products: { queued: number; failed: number };
}

export interface SyncDomainResult {
    attempted: number;
    synced: number;
    failed: number;
    remaining: number;
    error?: string;
}

export interface SyncCoordinatorResult {
    sales: SyncDomainResult;
    products: SyncDomainResult;
    lastError?: string;
}

const databaseSyncStatusListeners = new Set<() => void>();

export const subscribeToDatabaseSyncStatus = (listener: () => void) => {
    databaseSyncStatusListeners.add(listener);
    return () => { databaseSyncStatusListeners.delete(listener); };
};

const notifyDatabaseSyncStatusChanged = () => {
    databaseSyncStatusListeners.forEach((listener) => listener());
};

const syncStatusKey = (scope: ProductScope & TransactionScope) =>
    `@marketsync/database-sync-status:${scope.accountId}:${scope.businessId}:${scope.stallNumber}`;
const scopeKey = (scope: ProductScope & TransactionScope) =>
    `${scope.accountId}:${scope.businessId}:${scope.stallNumber}`;
const runtimeStatus = new Map<string, { syncing: boolean; lastError?: string }>();
const inFlightSyncs = new Map<string, Promise<SyncCoordinatorResult>>();

const readLastSyncedAt = async (scope: ProductScope & TransactionScope): Promise<number | null> => {
    const raw = await AsyncStorage.getItem(syncStatusKey(scope));
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as { lastSyncedAt?: unknown };
        return typeof parsed.lastSyncedAt === 'number' && Number.isFinite(parsed.lastSyncedAt)
            ? parsed.lastSyncedAt
            : null;
    } catch {
        return null;
    }
};

export const getDatabaseSyncStatus = async (
    scope: ProductScope & TransactionScope,
): Promise<DatabaseSyncStatus> => {
    const [transactions, products, lastSyncedAt] = await Promise.all([
        getUnsyncedTransactions(scope),
        getProductSyncSummary(scope),
        readLastSyncedAt(scope),
    ]);

    const salesFailed = transactions.filter((item) => Boolean(item.syncError)).length;
    const productQueued = products.pending + products.failed;
    const state = runtimeStatus.get(scopeKey(scope));
    const queued = transactions.length + productQueued;
    return {
        pending: queued,
        queued,
        failed: salesFailed + products.failed,
        syncing: state?.syncing ?? false,
        lastSyncedAt,
        lastError: state?.lastError,
        sales: { queued: transactions.length, failed: salesFailed },
        products: { queued: productQueued, failed: products.failed },
    };
};

const logSyncDebug = (event: string, details?: Record<string, unknown>) => {
    debugLog('supabase-sync', event, details);
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

const emptyResult: BatchSyncResult = { attempted: 0, synced: 0 };

export const syncProducts = async (scope: ProductScope): Promise<BatchSyncResult> => {
    try { return await syncScopedProducts(scope); }
    catch (error) { return { ...emptyResult, error: getErrorMessage(error) }; }
};

export const syncCategories = async (): Promise<BatchSyncResult> => {
    logSyncDebug('category upload skipped; the shared catalog is a read-through cache');
    return emptyResult;
};

export const syncPersonnel = async (): Promise<BatchSyncResult> => {
    logSyncDebug('personnel sync skipped; vendor applications are written directly');
    return emptyResult;
};

const executeSync = async (scope: ProductScope & TransactionScope): Promise<SyncCoordinatorResult> => {
    const key = scopeKey(scope);
    runtimeStatus.set(key, { syncing: true });
    notifyDatabaseSyncStatusChanged();
    try {
        const productAttempt = await syncProducts(scope);
        const aliases = await getListingIdAliases(scope);
        await Promise.all([
            reconcileCartListingIds(scope, aliases),
            reconcileUnsyncedTransactionListingIds(scope, aliases),
        ]);
        const saleAttempt = await syncUnsyncedTransactions(scope);
        const [remainingSales, productSummary] = await Promise.all([
            getUnsyncedTransactions(scope),
            getProductSyncSummary(scope),
        ]);
        const sales: SyncDomainResult = {
            ...saleAttempt,
            failed: Math.max(saleAttempt.attempted - saleAttempt.synced, 0),
            remaining: remainingSales.length,
            error: remainingSales.find((item) => item.syncError)?.syncError,
        };
        const products: SyncDomainResult = {
            attempted: productAttempt.attempted,
            synced: productAttempt.synced,
            failed: productAttempt.failed ?? Math.max(productAttempt.attempted - productAttempt.synced, 0),
            remaining: productSummary.pending + productSummary.failed,
            error: productAttempt.error,
        };
        const lastError = products.error ?? sales.error;
        const result = { sales, products, ...(lastError ? { lastError } : {}) };
        if (sales.remaining === 0 && products.remaining === 0 && !lastError) {
            await AsyncStorage.setItem(syncStatusKey(scope), JSON.stringify({ lastSyncedAt: Date.now() }));
        }
        runtimeStatus.set(key, { syncing: false, ...(lastError ? { lastError } : {}) });
        logSyncDebug('full sync complete', result);
        return result;
    } catch (error) {
        const lastError = getErrorMessage(error);
        runtimeStatus.set(key, { syncing: false, lastError });
        throw error;
    } finally {
        notifyDatabaseSyncStatusChanged();
    }
};

export const syncAllSupabaseData = (scope: ProductScope & TransactionScope): Promise<SyncCoordinatorResult> => {
    const key = scopeKey(scope);
    const active = inFlightSyncs.get(key);
    if (active) return active;
    const task = executeSync(scope).finally(() => {
        if (inFlightSyncs.get(key) === task) inFlightSyncs.delete(key);
    });
    inFlightSyncs.set(key, task);
    return task;
};
