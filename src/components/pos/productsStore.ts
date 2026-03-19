import AsyncStorage from '@react-native-async-storage/async-storage';
import { CATEGORY_PRODUCTS, normalizeCategoryLabel } from './data';

const POS_PRODUCTS_KEY = '@pos/products';
const POS_PRODUCTS_FALLBACK_KEY = 'pos-products';
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

export const loadMergedProductNamesByCategory = async (categoryId: string): Promise<string[]> => {
    const defaults = CATEGORY_PRODUCTS[categoryId] || [];
    const saved = await loadSavedProducts();
    const savedNames = saved
        .filter((product) => product.categoryId === categoryId)
        .map((product) => product.name);

    const unique = new Set<string>();

    defaults.forEach((name) => {
        unique.add(name);
    });

    savedNames.forEach((name) => {
        const exists = Array.from(unique).some((entry) => entry.toLowerCase() === name.toLowerCase());

        if (!exists) {
            unique.add(name);
        }
    });

    return Array.from(unique);
};
