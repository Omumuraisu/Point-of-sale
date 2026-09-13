import { isSupabaseConfigured, supabase } from './supabase';
import { syncUnsyncedTransactions } from './transactionsSync';
import { loadMergedCategories } from '../components/pos/categoriesStore';
import { ProductScope, getListingIdAliases, syncProducts as syncScopedProducts } from '../components/pos/productsStore';
import { reconcileCartListingIds } from '../components/pos/cartStore';
import { reconcileUnsyncedTransactionListingIds } from '../components/pos/transactionsStore';

interface BatchSyncResult {
    attempted: number;
    synced: number;
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

export const syncAllSupabaseData = async (scope: ProductScope): Promise<{
    transactions: { attempted: number; synced: number };
    products: BatchSyncResult;
    categories: BatchSyncResult;
    personnel: BatchSyncResult;
}> => {
    const products = await syncProducts(scope);
    const aliases = await getListingIdAliases(scope);
    await Promise.all([
        reconcileCartListingIds(scope, aliases),
        reconcileUnsyncedTransactionListingIds(scope.accountId, aliases),
    ]);
    const transactions = await syncUnsyncedTransactions(scope.accountId);
    const [categories, personnel] = await Promise.all([syncCategories(), syncPersonnel()]);

    logSyncDebug('full sync complete', {
        transactions,
        products,
        categories,
        personnel,
    });

    return {
        transactions,
        products,
        categories,
        personnel,
    };
};
