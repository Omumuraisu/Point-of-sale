import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { CategoryType } from '../../lib/types';
import { CATEGORY_ITEMS, createCustomCategory, normalizeCategoryLabel } from './data';
import { flattenCatalog, loadProductCatalog } from './catalogStore';
import { debugError, debugLog, debugWarn } from '../../lib/debugLogging';

const LEGACY_PRODUCTS_KEY = '@pos/products';
const LEGACY_PRODUCTS_FALLBACK_KEY = 'pos-products';
const LEGACY_MIGRATION_KEY = '@pos/products-migrated:v2';
const MAX_SAVED_PRODUCTS = 300;

export type ProductUnit = 'pieces' | 'kg' | 'g' | 'mg' | 'L' | 'mL';
export const PRODUCT_UNITS: ProductUnit[] = ['pieces', 'kg', 'g', 'mg', 'L', 'mL'];
export const isProductUnit = (value: unknown): value is ProductUnit =>
    typeof value === 'string' && PRODUCT_UNITS.includes(value as ProductUnit);

export interface ProductScope { accountId: number; stallNumber: string }
export type ProductSyncState = 'pending' | 'synced' | 'error';
export type ProductPendingAction = 'create' | 'update' | 'archive';

export interface SavedProductRecord {
    id: string;
    accountId: number;
    stallNumber: string;
    name: string;
    categoryId: string;
    categoryLabel: string;
    mainCategory: string;
    section: string;
    variant: string;
    pricePerUnit: number;
    unit: ProductUnit;
    createdAt: number;
    updatedAt: number;
    catalogProductId?: string;
    archivedAt?: number;
    syncState: ProductSyncState;
    pendingAction?: ProductPendingAction;
    syncError?: string;
}

export interface ProductMutationResult {
    product: SavedProductRecord | null;
    localSaved: boolean;
    synced: boolean;
    syncState: ProductSyncState;
    pendingAction?: ProductPendingAction;
    error?: string;
}

export interface ProductSyncSummary {
    attempted: number;
    synced: number;
    failed: number;
    pending: number;
    error?: string;
}

export type ProductCatalogItem = SavedProductRecord;

export interface SaveProductInput {
    name: string;
    categoryId: string;
    categoryLabel: string;
    mainCategory: string;
    section: string;
    variant?: string;
    catalogProductId?: string;
    pricePerUnit: number;
    unit: ProductUnit;
}

interface ProductsListRow {
    id: string; stall_number: string; name: string; category_id: string; category_label: string;
    price_per_unit: number; unit: string; created_at_ms: number; updated_at_ms: number | null;
    catalog_product_id: string | null; archived_at?: string | null;
    main_category?: string | null; section_name?: string | null; catalog_variant?: string | null;
}

const scopedKey = ({ accountId, stallNumber }: ProductScope) => `@pos/products:v2:${accountId}:${stallNumber}`;
const aliasesKey = ({ accountId, stallNumber }: ProductScope) => `@pos/product-aliases:v2:${accountId}:${stallNumber}`;
const identity = (product: Pick<SavedProductRecord, 'catalogProductId' | 'mainCategory' | 'section' | 'name' | 'variant'>) =>
    product.catalogProductId ?? [product.mainCategory, product.section, product.name, product.variant]
        .map((value) => normalizeCategoryLabel(value).toLowerCase()).join('::');
const newListingId = () => `pos-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const productSyncListeners = new Set<() => void>();
const emitProductSyncChange = () => productSyncListeners.forEach((listener) => listener());

export const subscribeToProductSyncChanges = (listener: () => void) => {
    productSyncListeners.add(listener);
    return () => { productSyncListeners.delete(listener); };
};

const isSavedProduct = (value: unknown): value is SavedProductRecord => {
    if (!value || typeof value !== 'object') return false;
    const row = value as Partial<SavedProductRecord>;
    return typeof row.id === 'string' && typeof row.accountId === 'number'
        && typeof row.stallNumber === 'string' && typeof row.name === 'string'
        && typeof row.categoryId === 'string' && typeof row.categoryLabel === 'string'
        && typeof row.mainCategory === 'string' && typeof row.section === 'string'
        && typeof row.variant === 'string' && typeof row.pricePerUnit === 'number'
        && Number.isFinite(row.pricePerUnit) && isProductUnit(row.unit)
        && typeof row.createdAt === 'number' && typeof row.updatedAt === 'number'
        && ['pending', 'synced', 'error'].includes(row.syncState ?? '');
};

const persist = async (scope: ProductScope, products: SavedProductRecord[]) => {
    await AsyncStorage.setItem(scopedKey(scope), JSON.stringify(products.slice(0, MAX_SAVED_PRODUCTS)));
};

export const loadSavedProducts = async (scope: ProductScope): Promise<SavedProductRecord[]> => {
    try {
        const raw = await AsyncStorage.getItem(scopedKey(scope));
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isSavedProduct) : [];
    } catch { return []; }
};

const catalogDetails = async (catalogProductId?: string) => {
    if (!catalogProductId) return undefined;
    return flattenCatalog(await loadProductCatalog()).find(({ product }) => product.id === catalogProductId);
};

const fromRemote = async (scope: ProductScope, row: ProductsListRow): Promise<SavedProductRecord | null> => {
    if (!isProductUnit(row.unit)) return null;
    const details = await catalogDetails(row.catalog_product_id ?? undefined);
    return {
        id: row.id, accountId: scope.accountId, stallNumber: row.stall_number, name: row.name,
        categoryId: row.category_id, categoryLabel: row.category_label,
        mainCategory: row.main_category ?? details?.category.name ?? row.category_label,
        section: row.section_name ?? details?.section.name ?? '',
        variant: row.catalog_variant ?? details?.product.variant ?? '',
        pricePerUnit: Number(row.price_per_unit), unit: row.unit,
        createdAt: Number(row.created_at_ms), updatedAt: Number(row.updated_at_ms ?? row.created_at_ms),
        catalogProductId: row.catalog_product_id ?? undefined,
        archivedAt: row.archived_at ? new Date(row.archived_at).getTime() : undefined,
        syncState: 'synced',
    };
};

const mergeByIdentity = (remote: SavedProductRecord[], local: SavedProductRecord[]) => {
    const merged = new Map(remote.map((item) => [identity(item), item]));
    local.forEach((item) => {
        const key = identity(item);
        const current = merged.get(key);
        if (!current || item.syncState !== 'synced' || item.updatedAt >= current.updatedAt) merged.set(key, item);
    });
    return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
};

export const migrateLegacyProducts = async (scope: ProductScope) => {
    if (await AsyncStorage.getItem(LEGACY_MIGRATION_KEY)) return;
    const raw = await AsyncStorage.getItem(LEGACY_PRODUCTS_KEY) ?? await AsyncStorage.getItem(LEGACY_PRODUCTS_FALLBACK_KEY);
    if (raw) {
        try {
            const old = JSON.parse(raw) as Array<Record<string, unknown>>;
            const migrated = old.filter((item) => typeof item.id === 'string' && typeof item.name === 'string')
                .map((item): SavedProductRecord => ({
                    id: String(item.id), accountId: scope.accountId, stallNumber: scope.stallNumber,
                    name: String(item.name), categoryId: String(item.categoryId ?? ''),
                    categoryLabel: String(item.categoryLabel ?? 'General'), mainCategory: String(item.categoryLabel ?? 'General'),
                    section: String(item.categoryLabel ?? 'General'), variant: '',
                    pricePerUnit: Number(item.pricePerUnit) || 0,
                    unit: isProductUnit(item.unit) ? item.unit : 'pieces',
                    createdAt: Number(item.createdAt) || Date.now(), updatedAt: Number(item.createdAt) || Date.now(),
                    syncState: 'pending', pendingAction: 'create',
                }));
            await persist(scope, migrated);
        } catch { /* Ignore malformed legacy storage. */ }
    }
    await AsyncStorage.setItem(LEGACY_MIGRATION_KEY, `${scope.accountId}:${scope.stallNumber}`);
};

export const loadScopedProducts = async (scope: ProductScope): Promise<SavedProductRecord[]> => {
    const startedAt = Date.now();
    await migrateLegacyProducts(scope);
    const local = await loadSavedProducts(scope);
    if (!isSupabaseConfigured || !supabase) {
        debugWarn('product-sync', 'product load using local cache', {
            stallNumber: scope.stallNumber, localCount: local.length, reason: 'Supabase is not configured.',
        });
        return local.filter((item) => !item.archivedAt);
    }
    const { data, error } = await supabase.rpc('get_catalog_listings', { p_stall_number: scope.stallNumber });
    if (error) {
        debugError('product-sync', 'remote product load failed', {
            stallNumber: scope.stallNumber, localCount: local.length, message: error.message,
            durationMs: Date.now() - startedAt,
        });
        return local.filter((item) => !item.archivedAt);
    }
    const remote = (await Promise.all(((data ?? []) as ProductsListRow[]).map((row) => fromRemote(scope, row))))
        .filter((item): item is SavedProductRecord => Boolean(item));
    const merged = mergeByIdentity(remote, local.filter((item) => item.syncState !== 'synced'));
    await persist(scope, merged);
    debugLog('product-sync', 'products loaded and merged', {
        stallNumber: scope.stallNumber, localCount: local.length, remoteCount: remote.length,
        mergedCount: merged.length, durationMs: Date.now() - startedAt,
    });
    return merged.filter((item) => !item.archivedAt);
};

const applyRpcResult = async (scope: ProductScope, localId: string, data: ProductsListRow): Promise<SavedProductRecord | null> => {
    const products = await loadSavedProducts(scope);
    const source = products.find((item) => item.id === localId);
    const remote = await fromRemote(scope, data);
    if (!remote) return null;
    const resolved = { ...remote, mainCategory: source?.mainCategory ?? remote.mainCategory,
        section: source?.section ?? remote.section, variant: source?.variant ?? remote.variant };
    const next = products.filter((item) => item.id !== localId && item.id !== resolved.id && identity(item) !== identity(resolved));
    next.unshift(resolved);
    await persist(scope, next);
    if (localId !== resolved.id) {
        const aliases = await getListingIdAliases(scope);
        aliases[localId] = resolved.id;
        await AsyncStorage.setItem(aliasesKey(scope), JSON.stringify(aliases));
    }
    return resolved;
};

export const getListingIdAliases = async (scope: ProductScope): Promise<Record<string, string>> => {
    try {
        const raw = await AsyncStorage.getItem(aliasesKey(scope));
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
};

const failedResult = async (
    scope: ProductScope,
    product: SavedProductRecord,
    message: string,
): Promise<ProductMutationResult> => {
    const failed = { ...product, syncState: 'error' as const, syncError: message };
    const all = await loadSavedProducts(scope);
    await persist(scope, all.map((item) => item.id === product.id ? failed : item));
    emitProductSyncChange();
    return {
        product: failed,
        localSaved: true,
        synced: false,
        syncState: 'error',
        pendingAction: failed.pendingAction,
        error: message,
    };
};

export const syncProductRecord = async (
    scope: ProductScope,
    product: SavedProductRecord,
    trigger: 'mutation' | 'automatic' | 'manual' = 'mutation',
): Promise<ProductMutationResult> => {
    const startedAt = Date.now();
    const operation = product.pendingAction ?? 'create';
    debugLog('product-sync', 'product sync started', {
        trigger, operation, listingId: product.id, stallNumber: scope.stallNumber,
    });
    if (!isSupabaseConfigured || !supabase) {
        const message = 'Unable to sync this product because Supabase is not configured.';
        debugError('product-sync', 'product sync unavailable', {
            trigger, operation, listingId: product.id, stallNumber: scope.stallNumber,
            message, durationMs: Date.now() - startedAt,
        });
        return failedResult(scope, product, message);
    }
    const rpc = product.pendingAction === 'archive' ? 'archive_catalog_listing'
        : product.pendingAction === 'update' ? 'update_catalog_listing' : 'create_catalog_listing';
    const args = product.pendingAction === 'archive'
        ? { p_listing_id: product.id, p_stall_number: scope.stallNumber }
        : product.pendingAction === 'update'
            ? { p_listing_id: product.id, p_stall_number: scope.stallNumber, p_price: product.pricePerUnit, p_unit: product.unit }
            : { p_listing_id: product.id, p_stall_number: scope.stallNumber, p_name: product.name,
                p_main_category: product.mainCategory, p_section: product.section, p_price: product.pricePerUnit,
                p_unit: product.unit, p_category_id: product.categoryId, p_category_label: product.categoryLabel,
                p_variant: product.variant };
    try {
        const { data, error } = await supabase.rpc(rpc, args);
        if (error) {
            debugError('product-sync', 'product sync failed', {
                trigger, operation, rpc, listingId: product.id, stallNumber: scope.stallNumber,
                message: error.message, code: error.code, durationMs: Date.now() - startedAt,
            });
            return failedResult(scope, product, error.message);
        }
        if (product.pendingAction === 'archive') {
            const all = await loadSavedProducts(scope);
            await persist(scope, all.filter((item) => item.id !== product.id));
            emitProductSyncChange();
            debugLog('product-sync', 'product sync succeeded', {
                trigger, operation, rpc, listingId: product.id, stallNumber: scope.stallNumber,
                durationMs: Date.now() - startedAt,
            });
            return { product: { ...product, syncState: 'synced', pendingAction: undefined, syncError: undefined },
                localSaved: true, synced: true, syncState: 'synced' };
        }
        const synced = await applyRpcResult(scope, product.id, (Array.isArray(data) ? data[0] : data) as ProductsListRow);
        if (!synced) {
            const message = 'The server returned an invalid product record.';
            debugError('product-sync', 'product sync returned invalid data', {
                trigger, operation, rpc, listingId: product.id, stallNumber: scope.stallNumber,
                durationMs: Date.now() - startedAt,
            });
            return failedResult(scope, product, message);
        }
        emitProductSyncChange();
        debugLog('product-sync', 'product sync succeeded', {
            trigger, operation, rpc, listingId: synced.id, stallNumber: scope.stallNumber,
            durationMs: Date.now() - startedAt,
        });
        return { product: synced, localSaved: true, synced: true, syncState: 'synced' };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected product synchronization error.';
        debugError('product-sync', 'product sync threw an exception', {
            trigger, operation, rpc, listingId: product.id, stallNumber: scope.stallNumber,
            message, durationMs: Date.now() - startedAt,
        });
        return failedResult(scope, product, message);
    }
};

export const saveProductRecord = async (scope: ProductScope, input: SaveProductInput): Promise<ProductMutationResult> => {
    if (!input.name.trim() || !input.mainCategory.trim() || !input.section.trim()
        || !Number.isFinite(input.pricePerUnit) || input.pricePerUnit <= 0 || !isProductUnit(input.unit)) {
        return { product: null, localSaved: false, synced: false, syncState: 'error', error: 'Enter a valid product, positive selling price, and unit.' };
    }
    const existing = await loadSavedProducts(scope);
    const candidate = { ...input, variant: input.variant?.trim() ?? '' };
    const duplicate = existing.find((item) => !item.archivedAt && identity(item) === identity(candidate as SavedProductRecord));
    const now = Date.now();
    const record: SavedProductRecord = {
        id: duplicate?.id ?? newListingId(), accountId: scope.accountId, stallNumber: scope.stallNumber,
        name: normalizeCategoryLabel(input.name), categoryId: input.categoryId, categoryLabel: normalizeCategoryLabel(input.categoryLabel),
        mainCategory: normalizeCategoryLabel(input.mainCategory), section: normalizeCategoryLabel(input.section),
        variant: candidate.variant, catalogProductId: input.catalogProductId,
        pricePerUnit: input.pricePerUnit, unit: input.unit, createdAt: duplicate?.createdAt ?? now, updatedAt: now,
        syncState: 'pending', pendingAction: duplicate?.syncState === 'synced' ? 'update' : 'create',
    };
    await persist(scope, [record, ...existing.filter((item) => item.id !== record.id)]);
    emitProductSyncChange();
    return syncProductRecord(scope, record);
};

export const updateProductRecord = async (scope: ProductScope, productId: string, pricePerUnit: number, unit: ProductUnit): Promise<ProductMutationResult> => {
    if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0 || !isProductUnit(unit)) {
        return { product: null, localSaved: false, synced: false, syncState: 'error', error: 'Enter a positive selling price and valid unit.' };
    }
    const existing = await loadSavedProducts(scope);
    const current = existing.find((item) => item.id === productId);
    if (!current) return { product: null, localSaved: false, synced: false, syncState: 'error', error: 'This product is no longer available.' };
    const pendingAction: ProductPendingAction = current.syncState === 'synced' ? 'update' : (current.pendingAction === 'archive' ? 'update' : current.pendingAction ?? 'create');
    const updated: SavedProductRecord = { ...current, pricePerUnit, unit, updatedAt: Date.now(), syncState: 'pending', pendingAction, syncError: undefined };
    await persist(scope, [updated, ...existing.filter((item) => item.id !== productId)]);
    emitProductSyncChange();
    return syncProductRecord(scope, updated);
};

export const deleteProductRecord = async (scope: ProductScope, productId: string): Promise<ProductMutationResult> => {
    const existing = await loadSavedProducts(scope);
    const current = existing.find((item) => item.id === productId);
    if (!current) return { product: null, localSaved: false, synced: false, syncState: 'error', error: 'This product is no longer available.' };
    if (current.pendingAction === 'create' && current.syncState !== 'synced') {
        await persist(scope, existing.filter((item) => item.id !== productId));
        emitProductSyncChange();
        debugLog('product-sync', 'unsynced local product removed', { listingId: productId, stallNumber: scope.stallNumber });
        return { product: current, localSaved: true, synced: true, syncState: 'synced' };
    }
    const archived = { ...current, archivedAt: current.archivedAt ?? Date.now(), updatedAt: Date.now(), syncState: 'pending' as const, pendingAction: 'archive' as const, syncError: undefined };
    await persist(scope, [archived, ...existing.filter((item) => item.id !== productId)]);
    emitProductSyncChange();
    return syncProductRecord(scope, archived);
};

export const retryProductSync = async (scope: ProductScope, productId: string): Promise<ProductMutationResult> => {
    const products = await loadSavedProducts(scope);
    let product = products.find((item) => item.id === productId);
    if (!product) {
        const aliases = await getListingIdAliases(scope);
        const resolvedId = aliases[productId];
        product = resolvedId ? products.find((item) => item.id === resolvedId) : undefined;
    }
    if (!product || product.syncState === 'synced') {
        return { product: product ?? null, localSaved: Boolean(product), synced: Boolean(product),
            syncState: product?.syncState ?? 'error', error: product ? undefined : 'The queued product change could not be found.' };
    }
    return syncProductRecord(scope, product, 'manual');
};

export const getProductSyncSummary = async (scope: ProductScope): Promise<ProductSyncSummary> => {
    const products = await loadSavedProducts(scope);
    return {
        attempted: 0,
        synced: 0,
        failed: products.filter((item) => item.syncState === 'error').length,
        pending: products.filter((item) => item.syncState === 'pending').length,
    };
};

export const syncProducts = async (scope: ProductScope): Promise<ProductSyncSummary> => {
    const products = await loadSavedProducts(scope);
    const pending = products.filter((item) => item.syncState !== 'synced');
    let synced = 0;
    let failed = 0;
    let lastError: string | undefined;
    debugLog('product-sync', 'product batch retry started', { stallNumber: scope.stallNumber, attempted: pending.length });
    for (const product of pending) {
        const result = await syncProductRecord(scope, product, 'automatic');
        if (result.synced) synced += 1;
        else { failed += 1; lastError = result.error; }
    }
    const summary = { attempted: pending.length, synced, failed, pending: 0, error: lastError };
    debugLog('product-sync', 'product batch retry finished', { stallNumber: scope.stallNumber, ...summary });
    return summary;
};

export const retryAllProductSync = async (scope: ProductScope): Promise<ProductSyncSummary> => {
    const products = await loadSavedProducts(scope);
    const queued = products.filter((item) => item.syncState !== 'synced');
    let synced = 0;
    let failed = 0;
    let lastError: string | undefined;
    debugLog('product-sync', 'manual product batch retry started', { stallNumber: scope.stallNumber, attempted: queued.length });
    for (const product of queued) {
        const result = await syncProductRecord(scope, product, 'manual');
        if (result.synced) synced += 1;
        else { failed += 1; lastError = result.error; }
    }
    const summary = { attempted: queued.length, synced, failed, pending: 0, error: lastError };
    debugLog('product-sync', 'manual product batch retry finished', { stallNumber: scope.stallNumber, ...summary });
    return summary;
};

export const loadMergedProductsByCategory = async (scope: ProductScope, categoryId: string) =>
    (await loadScopedProducts(scope)).filter((product) => product.categoryId === categoryId);

export const loadListingCategories = async (scope: ProductScope): Promise<CategoryType[]> => {
    const products = await loadScopedProducts(scope);
    const unique = new Map<string, string>();
    products.forEach((product) => unique.set(product.categoryId, product.categoryLabel));
    return Array.from(unique, ([id, label]) => {
        const style = CATEGORY_ITEMS.find((item) => item.label.toLowerCase() === label.toLowerCase());
        return style ? { ...style, id, label } : { ...createCustomCategory(label), id };
    });
};
