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

        return parsed.filter(isCartItem).map((item) => ({
            ...item,
            productListingId: item.productListingId ?? '',
            pricePerUnit: Number.isFinite(item.pricePerUnit) ? item.pricePerUnit : Number(item.pricePerKg ?? 0),
        }));
    } catch {
        return [];
    }
};
