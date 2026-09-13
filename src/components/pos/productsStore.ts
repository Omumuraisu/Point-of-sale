import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { CategoryType } from '../../lib/types';
import { CATEGORY_ITEMS, createCustomCategory, normalizeCategoryLabel } from './data';
import { flattenCatalog, loadProductCatalog } from './catalogStore';

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
    await migrateLegacyProducts(scope);
    const local = await loadSavedProducts(scope);
    if (!isSupabaseConfigured || !supabase) return local.filter((item) => !item.archivedAt);
    const { data, error } = await supabase.rpc('get_catalog_listings', { p_stall_number: scope.stallNumber });
    if (error) return local.filter((item) => !item.archivedAt);
    const remote = (await Promise.all(((data ?? []) as ProductsListRow[]).map((row) => fromRemote(scope, row))))
        .filter((item): item is SavedProductRecord => Boolean(item));
    const merged = mergeByIdentity(remote, local.filter((item) => item.syncState !== 'synced'));
    await persist(scope, merged);
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

export const syncProductRecord = async (scope: ProductScope, product: SavedProductRecord): Promise<SavedProductRecord | null> => {
    if (!isSupabaseConfigured || !supabase) return null;
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
    const { data, error } = await supabase.rpc(rpc, args);
    if (error) {
        const all = await loadSavedProducts(scope);
        await persist(scope, all.map((item) => item.id === product.id ? { ...item, syncState: 'error', syncError: error.message } : item));
        return null;
    }
    if (product.pendingAction === 'archive') {
        const all = await loadSavedProducts(scope);
        await persist(scope, all.filter((item) => item.id !== product.id));
        return product;
    }
    return applyRpcResult(scope, product.id, (Array.isArray(data) ? data[0] : data) as ProductsListRow);
};

export const saveProductRecord = async (scope: ProductScope, input: SaveProductInput): Promise<SavedProductRecord | null> => {
    if (!input.name.trim() || !input.mainCategory.trim() || !input.section.trim()
        || !Number.isFinite(input.pricePerUnit) || input.pricePerUnit <= 0 || !isProductUnit(input.unit)) return null;
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
    return (await syncProductRecord(scope, record)) ?? record;
};

export const updateProductRecord = async (scope: ProductScope, productId: string, pricePerUnit: number, unit: ProductUnit) => {
    if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0 || !isProductUnit(unit)) return null;
    const existing = await loadSavedProducts(scope);
    const current = existing.find((item) => item.id === productId);
    if (!current) return null;
    const updated: SavedProductRecord = { ...current, pricePerUnit, unit, updatedAt: Date.now(), syncState: 'pending', pendingAction: current.catalogProductId ? 'update' : 'create' };
    await persist(scope, [updated, ...existing.filter((item) => item.id !== productId)]);
    return (await syncProductRecord(scope, updated)) ?? updated;
};

export const deleteProductRecord = async (scope: ProductScope, productId: string) => {
    const existing = await loadSavedProducts(scope);
    const current = existing.find((item) => item.id === productId);
    if (!current) return;
    if (!current.catalogProductId && current.syncState !== 'synced') {
        await persist(scope, existing.filter((item) => item.id !== productId));
        return;
    }
    const archived = { ...current, archivedAt: Date.now(), updatedAt: Date.now(), syncState: 'pending' as const, pendingAction: 'archive' as const };
    await persist(scope, [archived, ...existing.filter((item) => item.id !== productId)]);
    await syncProductRecord(scope, archived);
};

export const syncProducts = async (scope: ProductScope) => {
    const products = await loadSavedProducts(scope);
    const pending = products.filter((item) => item.syncState !== 'synced');
    let synced = 0;
    for (const product of pending) if (await syncProductRecord(scope, product)) synced += 1;
    return { attempted: pending.length, synced };
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
