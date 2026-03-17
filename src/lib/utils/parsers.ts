import { CartItem } from '../types';
import { isCartItem } from './validators';

export const parseCart = (rawCart: unknown): CartItem[] => {
    if (typeof rawCart !== 'string' || !rawCart.trim()) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawCart);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(isCartItem);
    } catch {
        return [];
    }
};
