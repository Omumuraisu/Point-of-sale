import AsyncStorage from '@react-native-async-storage/async-storage';
import { CATEGORY_PRODUCTS, normalizeCategoryLabel } from './data';

const POS_PRODUCTS_KEY = '@pos/products';
const POS_PRODUCTS_FALLBACK_KEY = 'pos-products';
const POS_HIDDEN_DEFAULT_PRODUCTS_KEY = '@pos/hidden-default-products';
const POS_HIDDEN_DEFAULT_PRODUCTS_FALLBACK_KEY = 'pos-hidden-default-products';
const MAX_SAVED_PRODUCTS = 300;

export type ProductUnit = 'pieces' | 'kg' | 'g' | 'mg' | 'L' | 'mL';

const PRODUCT_UNITS: ProductUnit[] = ['pieces', 'kg', 'g', 'mg', 'L', 'mL'];

const isProductUnit = (value: unknown): value is ProductUnit =>
    typeof value === 'string' && PRODUCT_UNITS.includes(value as ProductUnit);

export interface SavedProductRecord {
    id: string;
    name: string;
    categoryId: string;
    categoryLabel: string;
    pricePerUnit: number;
    unit: ProductUnit;
    createdAt: number;
}

interface SaveProductInput {
    name: string;
    categoryId: string;
    categoryLabel: string;
    pricePerUnit: number;
    unit: ProductUnit;
}

export interface ProductCatalogItem {
    id: string;
    name: string;
    categoryId: string;
    categoryLabel: string;
    pricePerUnit: number;
    unit: ProductUnit;
    source: 'default' | 'saved';
    defaultKey?: string;
    originalName?: string;
}

export interface UpdateProductInput extends SaveProductInput {
    productId?: string;
    source: 'default' | 'saved';
    defaultKey?: string;
}

interface DeleteProductInput {
    productId?: string;
    source: 'default' | 'saved';
    defaultKey?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isSavedProductRecord = (value: unknown): value is SavedProductRecord => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.id === 'string'
        && typeof value.name === 'string'
        && typeof value.categoryId === 'string'
        && typeof value.categoryLabel === 'string'
        && typeof value.pricePerUnit === 'number'
        && Number.isFinite(value.pricePerUnit)
        && isProductUnit(value.unit)
        && typeof value.createdAt === 'number'
        && Number.isFinite(value.createdAt);
};

export const loadSavedProducts = async (): Promise<SavedProductRecord[]> => {
    try {
        const raw = await AsyncStorage.getItem(POS_PRODUCTS_KEY)
            ?? await AsyncStorage.getItem(POS_PRODUCTS_FALLBACK_KEY);

        if (!raw) {
            return [];
        }

        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(isSavedProductRecord);
    } catch (error) {
        if (__DEV__) {
            console.error('[PRODUCTS_DEBUG] Failed to load saved products:', error);
        }

        return [];
    }
};

export const createDefaultProductKey = (categoryId: string, productName: string): string =>
    `${categoryId}::${normalizeCategoryLabel(productName).toLowerCase()}`;

const loadHiddenDefaultProductKeys = async (): Promise<string[]> => {
    try {
        const raw = await AsyncStorage.getItem(POS_HIDDEN_DEFAULT_PRODUCTS_KEY)
            ?? await AsyncStorage.getItem(POS_HIDDEN_DEFAULT_PRODUCTS_FALLBACK_KEY);

        if (!raw) {
            return [];
        }

        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter((item): item is string => typeof item === 'string');
    } catch (error) {
        if (__DEV__) {
            console.error('[PRODUCTS_DEBUG] Failed to load hidden default products:', error);
        }

        return [];
    }
};

const persistHiddenDefaultProductKeys = async (keys: string[]): Promise<void> => {
    const uniqueKeys = Array.from(new Set(keys));

    try {
        await AsyncStorage.setItem(POS_HIDDEN_DEFAULT_PRODUCTS_KEY, JSON.stringify(uniqueKeys));
    } catch (primaryError) {
        if (__DEV__) {
            console.error('[PRODUCTS_DEBUG] Primary hidden default save failed, trying fallback key:', primaryError);
        }

        await AsyncStorage.setItem(POS_HIDDEN_DEFAULT_PRODUCTS_FALLBACK_KEY, JSON.stringify(uniqueKeys));
    }
};

const persistSavedProducts = async (products: SavedProductRecord[]): Promise<void> => {
    const trimmed = products.slice(0, MAX_SAVED_PRODUCTS);

    try {
        await AsyncStorage.setItem(POS_PRODUCTS_KEY, JSON.stringify(trimmed));
    } catch (primaryError) {
        if (__DEV__) {
            console.error('[PRODUCTS_DEBUG] Primary save failed, trying fallback key:', primaryError);
        }

        await AsyncStorage.setItem(POS_PRODUCTS_FALLBACK_KEY, JSON.stringify(trimmed));
    }
};

const toSavedProduct = (
    product: SavedProductRecord,
    source: ProductCatalogItem['source'] = 'saved',
): ProductCatalogItem => ({
    id: product.id,
    name: product.name,
    categoryId: product.categoryId,
    categoryLabel: product.categoryLabel,
    pricePerUnit: product.pricePerUnit,
    unit: product.unit,
    source,
});

export const saveProductRecord = async (input: SaveProductInput): Promise<SavedProductRecord | null> => {
    const normalizedName = normalizeCategoryLabel(input.name);
    const normalizedCategoryLabel = normalizeCategoryLabel(input.categoryLabel);

    if (!normalizedName || !input.categoryId) {
        return null;
    }

    const existing = await loadSavedProducts();
    const existingIndex = existing.findIndex((product) => (
        product.categoryId === input.categoryId
        && product.name.toLowerCase() === normalizedName.toLowerCase()
    ));

    const nextRecord: SavedProductRecord = {
        id: existingIndex >= 0 ? existing[existingIndex].id : `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: normalizedName,
        categoryId: input.categoryId,
        categoryLabel: normalizedCategoryLabel,
        pricePerUnit: Number.isFinite(input.pricePerUnit) ? input.pricePerUnit : 0,
        unit: input.unit,
        createdAt: existingIndex >= 0 ? existing[existingIndex].createdAt : Date.now(),
    };

    const nextList = [...existing];

    if (existingIndex >= 0) {
        nextList.splice(existingIndex, 1, nextRecord);
    } else {
        nextList.unshift(nextRecord);
    }

    await persistSavedProducts(nextList);

    return nextRecord;
};

export const deleteProductRecord = async (input: DeleteProductInput): Promise<void> => {
    if (input.source === 'default') {
        if (!input.defaultKey) {
            return;
        }

        const hiddenKeys = await loadHiddenDefaultProductKeys();
        await persistHiddenDefaultProductKeys([...hiddenKeys, input.defaultKey]);
        return;
    }

    if (!input.productId) {
        return;
    }

    const existing = await loadSavedProducts();
    await persistSavedProducts(existing.filter((product) => product.id !== input.productId));
};

export const updateProductRecord = async (input: UpdateProductInput): Promise<SavedProductRecord | null> => {
    const normalizedName = normalizeCategoryLabel(input.name);
    const normalizedCategoryLabel = normalizeCategoryLabel(input.categoryLabel);

    if (!normalizedName || !input.categoryId) {
        return null;
    }

    const existing = await loadSavedProducts();
    const existingIndex = input.productId
        ? existing.findIndex((product) => product.id === input.productId)
        : -1;
    const duplicateIndex = existing.findIndex((product) => (
        product.categoryId === input.categoryId
        && product.name.toLowerCase() === normalizedName.toLowerCase()
        && product.id !== input.productId
    ));
    const preservedRecord = existingIndex >= 0
        ? existing[existingIndex]
        : (duplicateIndex >= 0 ? existing[duplicateIndex] : undefined);

    const nextRecord: SavedProductRecord = {
        id: preservedRecord?.id ?? `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: normalizedName,
        categoryId: input.categoryId,
        categoryLabel: normalizedCategoryLabel,
        pricePerUnit: Number.isFinite(input.pricePerUnit) ? input.pricePerUnit : 0,
        unit: input.unit,
        createdAt: preservedRecord?.createdAt ?? Date.now(),
    };

    const nextList = existing.filter((_, index) => (
        index !== existingIndex && index !== duplicateIndex
    ));
    nextList.unshift(nextRecord);

    await persistSavedProducts(nextList);

    if (input.source === 'default' && input.defaultKey) {
        const hiddenKeys = await loadHiddenDefaultProductKeys();
        await persistHiddenDefaultProductKeys([...hiddenKeys, input.defaultKey]);
    }

    return nextRecord;
};

export const loadMergedProductsByCategory = async (
    categoryId: string,
    categoryLabel = 'Category',
): Promise<ProductCatalogItem[]> => {
    const defaults = CATEGORY_PRODUCTS[categoryId] || [];
    const saved = await loadSavedProducts();
    const hiddenKeys = new Set(await loadHiddenDefaultProductKeys());
    const merged: ProductCatalogItem[] = [];

    defaults.forEach((name) => {
        const defaultKey = createDefaultProductKey(categoryId, name);

        if (hiddenKeys.has(defaultKey)) {
            return;
        }

        merged.push({
            id: defaultKey,
            name,
            categoryId,
            categoryLabel,
            pricePerUnit: 0,
            unit: 'kg',
            source: 'default',
            defaultKey,
            originalName: name,
        });
    });

    saved
        .filter((product) => product.categoryId === categoryId)
        .forEach((product) => {
            const savedItem = toSavedProduct(product);
            const existingIndex = merged.findIndex((entry) => (
                entry.name.toLowerCase() === product.name.toLowerCase()
            ));

            if (existingIndex >= 0) {
                merged.splice(existingIndex, 1, savedItem);
            } else {
                merged.push(savedItem);
            }
        });

    return merged;
};

export const loadMergedProductNamesByCategory = async (categoryId: string): Promise<string[]> => {
    const merged = await loadMergedProductsByCategory(categoryId);

    return merged.map((product) => product.name);
};
