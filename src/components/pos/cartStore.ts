import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem } from '../../lib/types';
import { isCartItem } from '../../lib/utils';

const POS_CART_KEY = '@pos/current-cart';
const POS_CART_FALLBACK_KEY = 'pos-current-cart';

export const loadPersistedCartItems = async (): Promise<CartItem[]> => {
    try {
        const raw = await AsyncStorage.getItem(POS_CART_KEY)
            ?? await AsyncStorage.getItem(POS_CART_FALLBACK_KEY);

        if (!raw) {
            return [];
        }

        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(isCartItem);
    } catch (error) {
        if (__DEV__) {
            console.error('[CART_DEBUG] Failed to load persisted cart:', error);
        }

        return [];
    }
};

export const savePersistedCartItems = async (cartItems: CartItem[]): Promise<void> => {
    try {
        await AsyncStorage.setItem(POS_CART_KEY, JSON.stringify(cartItems));
    } catch (primaryError) {
        if (__DEV__) {
            console.error('[CART_DEBUG] Primary cart save failed, trying fallback key:', primaryError);
        }

        try {
            await AsyncStorage.setItem(POS_CART_FALLBACK_KEY, JSON.stringify(cartItems));
        } catch (fallbackError) {
            if (__DEV__) {
                console.error('[CART_DEBUG] Fallback cart save failed:', fallbackError);
            }
        }
    }
};

export const clearPersistedCartItems = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem(POS_CART_KEY);
        await AsyncStorage.removeItem(POS_CART_FALLBACK_KEY);
    } catch (error) {
        if (__DEV__) {
            console.error('[CART_DEBUG] Failed to clear persisted cart:', error);
        }
    }
};
