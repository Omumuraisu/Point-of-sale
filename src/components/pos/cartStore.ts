import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem } from '../../lib/types';
import { parseCart } from '../../lib/utils';
import { ProductScope } from './productsStore';

const LEGACY_KEY = '@pos/current-cart';
const LEGACY_FALLBACK_KEY = 'pos-current-cart';
const LEGACY_OWNER_KEY = '@pos/cart-legacy-owner:v2';
const scopedKey = (scope: ProductScope) => `@pos/current-cart:v2:${scope.accountId}:${scope.stallNumber}`;

export const loadPersistedCartItems = async (scope: ProductScope): Promise<CartItem[]> => {
    try {
        let raw = await AsyncStorage.getItem(scopedKey(scope));
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
    await AsyncStorage.setItem(scopedKey(scope), JSON.stringify(cartItems));
};

export const clearPersistedCartItems = async (scope: ProductScope) => {
    await AsyncStorage.removeItem(scopedKey(scope));
};

export const reconcileCartListingIds = async (scope: ProductScope, aliases: Record<string, string>) => {
    const cart = await loadPersistedCartItems(scope);
    const next = cart.map((item) => ({ ...item, productListingId: aliases[item.productListingId] ?? item.productListingId }));
    if (next.some((item, index) => item.productListingId !== cart[index].productListingId)) {
        await savePersistedCartItems(scope, next);
    }
};
