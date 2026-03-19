import { CartItem, CategoryType, TransactionCategoryType, TransactionRecord } from '../types';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const isTransactionCategoryType = (value: unknown): value is TransactionCategoryType => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.key === 'string' && typeof value.label === 'string';
};

export const isCartItem = (value: unknown): value is CartItem => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.id === 'string'
        && typeof value.name === 'string'
        && typeof value.category === 'string'
        && typeof value.quantity === 'number'
        && Number.isFinite(value.quantity)
        && typeof value.unit === 'string'
        && typeof value.pricePerKg === 'number'
        && Number.isFinite(value.pricePerKg)
        && typeof value.total === 'number'
        && Number.isFinite(value.total)
        && typeof value.createdAt === 'number'
        && Number.isFinite(value.createdAt);
};

export const isCategoryType = (value: unknown): value is CategoryType => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.id === 'string'
        && typeof value.label === 'string'
        && typeof value.icon === 'string'
        && typeof value.bgColor === 'string'
        && typeof value.borderColor === 'string'
        && typeof value.textColor === 'string';
};

export const isTransactionRecord = (value: unknown): value is TransactionRecord => {
    if (!isRecord(value)) {
        return false;
    }

    const hasValidCartItems = value.cartItems === undefined
        || (Array.isArray(value.cartItems) && value.cartItems.every(isCartItem));

    const hasValidPaidAmount = value.paidAmount === undefined
        || (typeof value.paidAmount === 'number' && Number.isFinite(value.paidAmount));

    const hasValidTotalDue = value.totalDue === undefined
        || (typeof value.totalDue === 'number' && Number.isFinite(value.totalDue));

    return typeof value.id === 'string'
        && typeof value.item === 'string'
        && typeof value.amount === 'string'
        && typeof value.subtitle === 'string'
        && typeof value.category === 'string'
        && isTransactionCategoryType(value.categoryType)
        && typeof value.dateLabel === 'string'
        && typeof value.createdAt === 'number'
        && Number.isFinite(value.createdAt)
        && hasValidCartItems
        && hasValidPaidAmount
        && hasValidTotalDue;
};
