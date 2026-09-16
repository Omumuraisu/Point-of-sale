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
        && ((typeof value.pricePerUnit === 'number' && Number.isFinite(value.pricePerUnit))
            || (typeof value.pricePerKg === 'number' && Number.isFinite(value.pricePerKg)))
        && (value.productListingId === undefined || typeof value.productListingId === 'string')
        && (value.catalogProductId === undefined || typeof value.catalogProductId === 'string')
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

    const hasValidAccountId = value.accountId === undefined
        || (typeof value.accountId === 'number' && Number.isFinite(value.accountId));

    const hasValidUsername = value.username === undefined || typeof value.username === 'string';

    const hasValidOrderId = value.orderId === undefined
        || (typeof value.orderId === 'number' && Number.isFinite(value.orderId));

    const hasValidClientOrderKey = value.clientOrderKey === undefined || typeof value.clientOrderKey === 'string';

    const hasValidBusinessId = value.businessId === undefined
        || value.businessId === null
        || (typeof value.businessId === 'number' && Number.isFinite(value.businessId));

    const hasValidStallId = value.stallId === undefined
        || value.stallId === null
        || typeof value.stallId === 'string';

    const hasValidStallNumber = value.stallNumber === undefined
        || value.stallNumber === null
        || typeof value.stallNumber === 'string';

    const hasValidPaidAmount = value.paidAmount === undefined
        || (typeof value.paidAmount === 'number' && Number.isFinite(value.paidAmount));

    const hasValidTotalDue = value.totalDue === undefined
        || (typeof value.totalDue === 'number' && Number.isFinite(value.totalDue));

    const hasValidPreparedAt = value.preparedAt === undefined
        || (typeof value.preparedAt === 'number' && Number.isFinite(value.preparedAt));

    const hasValidCompletedAt = value.completedAt === undefined
        || (typeof value.completedAt === 'number' && Number.isFinite(value.completedAt));

    const hasValidChangeAmount = value.changeAmount === undefined
        || (typeof value.changeAmount === 'number' && Number.isFinite(value.changeAmount));

    const hasValidSynced = value.synced === undefined || typeof value.synced === 'boolean';

    const hasValidSyncedAt = value.syncedAt === undefined
        || (typeof value.syncedAt === 'number' && Number.isFinite(value.syncedAt));

    const hasValidSyncError = value.syncError === undefined || typeof value.syncError === 'string';

    const hasValidSyncAttempts = value.syncAttempts === undefined
        || (typeof value.syncAttempts === 'number' && Number.isFinite(value.syncAttempts));

    return typeof value.id === 'string'
        && typeof value.item === 'string'
        && typeof value.amount === 'string'
        && typeof value.subtitle === 'string'
        && typeof value.category === 'string'
        && isTransactionCategoryType(value.categoryType)
        && typeof value.dateLabel === 'string'
        && typeof value.createdAt === 'number'
        && Number.isFinite(value.createdAt)
        && hasValidAccountId
        && hasValidUsername
        && hasValidOrderId
        && hasValidClientOrderKey
        && hasValidBusinessId
        && hasValidStallId
        && hasValidStallNumber
        && hasValidCartItems
        && hasValidPaidAmount
        && hasValidTotalDue
        && hasValidPreparedAt
        && hasValidCompletedAt
        && hasValidChangeAmount
        && hasValidSynced
        && hasValidSyncedAt
        && hasValidSyncError
        && hasValidSyncAttempts;
};
