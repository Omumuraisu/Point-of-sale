import { isSupabaseConfigured, supabase } from './supabase';
import { syncUnsyncedTransactions } from './transactionsSync';
import { loadMergedCategories } from '../components/pos/categoriesStore';
import { loadSavedProducts } from '../components/pos/productsStore';
import { loadPersonnelRecords } from '../components/rent/personnelStore';

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

export const syncProducts = async (): Promise<BatchSyncResult> => {
    const configError = ensureSupabaseClient();
    const client = supabase;

    if (configError || !client) {
        return {
            ...emptyResult,
            error: configError ?? 'Supabase is not configured.',
        };
    }

    const products = await loadSavedProducts();

    if (products.length === 0) {
        return emptyResult;
    }

    try {
        const { error } = await client
            .from('products')
            .upsert(
                products.map((product) => ({
                    id: product.id,
                    name: product.name,
                    category_id: product.categoryId,
                    category_label: product.categoryLabel,
                    price_per_unit: product.pricePerUnit,
                    unit: product.unit,
                    created_at_ms: product.createdAt,
                })),
                { onConflict: 'id' },
            );

        if (error) {
            return { attempted: products.length, synced: 0, error: error.message };
        }

        logSyncDebug('products synced', { count: products.length });
        return { attempted: products.length, synced: products.length };
    } catch (error) {
        return { attempted: products.length, synced: 0, error: getErrorMessage(error) };
    }
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
    const configError = ensureSupabaseClient();
    const client = supabase;

    if (configError || !client) {
        return {
            ...emptyResult,
            error: configError ?? 'Supabase is not configured.',
        };
    }

    const personnel = await loadPersonnelRecords();

    if (personnel.length === 0) {
        return emptyResult;
    }

    try {
        const { error } = await client
            .from('personnel')
            .upsert(
                personnel.map((record) => ({
                    id: record.id,
                    first_name: record.firstName,
                    last_name: record.lastName,
                    birthday: record.birthday,
                    address: record.address,
                    phone_number: record.phoneNumber,
                    email: record.email,
                    documents: record.documents ?? [],
                    status: record.status,
                    created_at_ms: record.createdAt,
                })),
                { onConflict: 'id' },
            );

        if (error) {
            return { attempted: personnel.length, synced: 0, error: error.message };
        }

        if (__DEV__) {
            console.log('[PERSONNEL_DEBUG] Personnel synced to database', {
                count: personnel.length,
                personnel: personnel.map((record) => ({
                    id: record.id,
                    fullName: `${record.firstName} ${record.lastName}`.trim(),
                })),
            });
        }

        logSyncDebug('personnel synced', { count: personnel.length });
        return { attempted: personnel.length, synced: personnel.length };
    } catch (error) {
        return { attempted: personnel.length, synced: 0, error: getErrorMessage(error) };
    }
};

export const syncAllSupabaseData = async (): Promise<{
    transactions: { attempted: number; synced: number };
    products: BatchSyncResult;
    categories: BatchSyncResult;
    personnel: BatchSyncResult;
}> => {
    const [transactions, products, categories, personnel] = await Promise.all([
        syncUnsyncedTransactions(),
        syncProducts(),
        syncCategories(),
        syncPersonnel(),
    ]);

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
