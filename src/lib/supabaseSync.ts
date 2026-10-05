import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from './supabase';
import { syncUnsyncedTransactions } from './transactionsSync';
import { loadMergedCategories } from '../components/pos/categoriesStore';
import { ProductScope, getListingIdAliases, getProductSyncSummary, syncProducts as syncScopedProducts } from '../components/pos/productsStore';
import { reconcileCartListingIds } from '../components/pos/cartStore';
import { getUnsyncedTransactions, reconcileUnsyncedTransactionListingIds } from '../components/pos/transactionsStore';
import { debugLog } from './debugLogging';
import { TransactionScope } from './types';

interface BatchSyncResult {
    attempted: number;
    synced: number;
    error?: string;
}

export interface DatabaseSyncStatus {
    pending: number;
    lastSyncedAt: number | null;
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

    return {
        pending: transactions.length + products.pending + products.failed,
        lastSyncedAt,
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

const ensureSupabaseClient = (): string | null => {
    if (!isSupabaseConfigured || !supabase) {
        return 'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.';
    }

    return null;
};

export const syncProducts = async (scope: ProductScope): Promise<BatchSyncResult> => {
    try { return await syncScopedProducts(scope); }
    catch (error) { return { ...emptyResult, error: getErrorMessage(error) }; }
};

export const syncCategories = async (): Promise<BatchSyncResult> => {
    const configError = ensureSupabaseClient();
    const client = supabase;

    if (configError || !client) {
        return {
            ...emptyResult,
            error: configError ?? 'Supabase is not configured.',
        };
    }

    const categories = await loadMergedCategories();

    if (categories.length === 0) {
        return emptyResult;
    }

    try {
        const { error } = await client
            .from('categories')
            .upsert(
                categories.map((category) => ({
                    id: category.id,
                    label: category.label,
                    icon: category.icon,
                    bg_color: category.bgColor,
                    border_color: category.borderColor,
                    text_color: category.textColor,
                })),
                { onConflict: 'id' },
            );

        if (error) {
            return { attempted: categories.length, synced: 0, error: error.message };
        }

        logSyncDebug('categories synced', { count: categories.length });
        return { attempted: categories.length, synced: categories.length };
    } catch (error) {
        return { attempted: categories.length, synced: 0, error: getErrorMessage(error) };
    }
};

export const syncPersonnel = async (): Promise<BatchSyncResult> => {
    logSyncDebug('personnel sync skipped; vendor applications are written directly');
    return emptyResult;
};

export const syncAllSupabaseData = async (scope: ProductScope & TransactionScope): Promise<{
    transactions: { attempted: number; synced: number };
    products: BatchSyncResult;
    categories: BatchSyncResult;
    personnel: BatchSyncResult;
}> => {
    const products = await syncProducts(scope);
    const aliases = await getListingIdAliases(scope);
    await Promise.all([
        reconcileCartListingIds(scope, aliases),
        reconcileUnsyncedTransactionListingIds(scope, aliases),
    ]);
    const transactions = await syncUnsyncedTransactions(scope);
    const [categories, personnel] = await Promise.all([syncCategories(), syncPersonnel()]);

    logSyncDebug('full sync complete', {
        transactions,
        products,
        categories,
        personnel,
    });

    const hasFailures = transactions.synced < transactions.attempted
        || products.synced < products.attempted
        || categories.synced < categories.attempted
        || Boolean(products.error)
        || Boolean(categories.error)
        || Boolean(personnel.error);

    if (!hasFailures) {
        await AsyncStorage.setItem(syncStatusKey(scope), JSON.stringify({ lastSyncedAt: Date.now() }));
        notifyDatabaseSyncStatusChanged();
    }

    return {
        transactions,
        products,
        categories,
        personnel,
    };
};
