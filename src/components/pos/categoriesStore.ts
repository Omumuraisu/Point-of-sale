import AsyncStorage from '@react-native-async-storage/async-storage';
import { CategoryType } from '../../lib/types';
import { isCategoryType } from '../../lib/utils';
import { mergeCategoriesWithDefaults } from './data';
import { debugError, debugWarn } from '../../lib/debugLogging';

const POS_CATEGORIES_KEY = '@pos/categories';
const POS_CATEGORIES_FALLBACK_KEY = 'pos-categories';
const MAX_CUSTOM_CATEGORIES = 60;

export const loadCustomCategories = async (): Promise<CategoryType[]> => {
    try {
        const raw = await AsyncStorage.getItem(POS_CATEGORIES_KEY)
            ?? await AsyncStorage.getItem(POS_CATEGORIES_FALLBACK_KEY);

        if (!raw) {
            return [];
        }

        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(isCategoryType);
    } catch (error) {
        debugError('catalog-categories', 'failed to load custom categories', { error });

        return [];
    }
};

export const saveCustomCategories = async (categories: CategoryType[]): Promise<void> => {
    const uniqueById = new Map<string, CategoryType>();

    categories.forEach((category) => {
        if (!uniqueById.has(category.id)) {
            uniqueById.set(category.id, category);
        }
    });

    const normalized = Array.from(uniqueById.values()).slice(0, MAX_CUSTOM_CATEGORIES);

    try {
        await AsyncStorage.setItem(POS_CATEGORIES_KEY, JSON.stringify(normalized));
    } catch (primaryError) {
        debugWarn('catalog-categories', 'primary category save failed; trying fallback', { error: primaryError });

        await AsyncStorage.setItem(POS_CATEGORIES_FALLBACK_KEY, JSON.stringify(normalized));
    }
};

export const loadMergedCategories = async (): Promise<CategoryType[]> => {
    const custom = await loadCustomCategories();

    return mergeCategoriesWithDefaults(custom);
};
