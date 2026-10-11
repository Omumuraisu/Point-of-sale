import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem } from '../../lib/types';
import { parseCart } from '../../lib/utils';
import { ProductScope } from './productsStore';

const LEGACY_KEY = '@pos/current-cart';
const LEGACY_FALLBACK_KEY = 'pos-current-cart';
const LEGACY_OWNER_KEY = '@pos/cart-legacy-owner:v2';
const scopedKey = (scope: ProductScope) => `@pos/current-cart:v3:${scope.accountId}:${scope.businessId}:${scope.stallNumber}`;
const scopedFallbackKey = (scope: ProductScope) => `pos-current-cart:v3:${scope.accountId}:${scope.businessId}:${scope.stallNumber}`;
const legacyScopedKey = (scope: ProductScope) => `@pos/current-cart:v2:${scope.accountId}:${scope.stallNumber}`;
const migrationKey = (scope: ProductScope) => `@pos/cart-migrated:v3:${scope.accountId}:${scope.businessId}:${scope.stallNumber}`;

export const loadPersistedCartItems = async (scope: ProductScope): Promise<CartItem[]> => {
    try {
        let raw = await AsyncStorage.getItem(scopedKey(scope)) ?? await AsyncStorage.getItem(scopedFallbackKey(scope));
        if (!raw && !(await AsyncStorage.getItem(migrationKey(scope)))) {
            raw = await AsyncStorage.getItem(legacyScopedKey(scope));
            if (raw) await AsyncStorage.setItem(scopedKey(scope), raw);
            await AsyncStorage.setItem(migrationKey(scope), 'complete');
        }
        const legacyOwner = await AsyncStorage.getItem(LEGACY_OWNER_KEY);
        if (!raw && !legacyOwner) {
            raw = await AsyncStorage.getItem(LEGACY_KEY) ?? await AsyncStorage.getItem(LEGACY_FALLBACK_KEY);
            await AsyncStorage.setItem(LEGACY_OWNER_KEY, `${scope.accountId}:${scope.stallNumber}`);
            if (raw) await AsyncStorage.setItem(scopedKey(scope), raw);
        }
        return parseCart(raw ?? '');
    } catch { return []; }
};

export const savePersistedCartItems = async (scope: ProductScope, cartItems: CartItem[]) => {
    const serialized = JSON.stringify(cartItems);
    try {
        await AsyncStorage.setItem(scopedKey(scope), serialized);
    } catch {
        await AsyncStorage.setItem(scopedFallbackKey(scope), serialized);
    }
};

export const clearPersistedCartItems = async (scope: ProductScope) => {
    await Promise.all([
        AsyncStorage.removeItem(scopedKey(scope)),
        AsyncStorage.removeItem(scopedFallbackKey(scope)),
    ]);
};

export const reconcileCartListingIds = async (scope: ProductScope, aliases: Record<string, string>) => {
    const cart = await loadPersistedCartItems(scope);
    const next = cart.map((item) => ({ ...item, productListingId: aliases[item.productListingId] ?? item.productListingId }));
    if (next.some((item, index) => item.productListingId !== cart[index].productListingId)) {
        await savePersistedCartItems(scope, next);
    }
};
