import { SaveReceiptTransactionInput, TransactionCategoryType, TransactionRecord } from '../types';
import { normalizeCategoryTags } from '../transactionCategories';
import { formatCurrency, formatTransactionDate } from './formatters';

export const getCategoryType = (category: string): TransactionCategoryType => {
    const normalized = String(category).toLowerCase();

    if (normalized.includes('meat')) {
        return { key: 'meat', label: 'Meat' };
    }

    if (normalized.includes('dry')) {
        return { key: 'dry', label: 'Dry' };
    }

    return { key: 'neutral', label: 'Neutral' };
};

export const toTransaction = ({
    cartItems,
    paidAmount,
    totalDue,
    createdAt,
    accountId,
    username,
    clientOrderKey,
    preparedAt,
    businessId,
    stallId,
    stallNumber,
}: SaveReceiptTransactionInput & { createdAt: number }): TransactionRecord => {
    const itemCount = cartItems.length;
    const firstItem = cartItems[0];

    const categories = normalizeCategoryTags(cartItems.map((item) => item.category));
    const category = categories[0] ?? 'General';

    const itemTitle = itemCount > 1
        ? `${firstItem.name} +${itemCount - 1} more`
        : firstItem.name;

    const settledAmount = Number.isFinite(totalDue) && totalDue > 0
        ? totalDue
        : cartItems.reduce((sum, item) => sum + item.total, 0);

    const paidValue = Number.isFinite(paidAmount) && paidAmount > 0 ? paidAmount : settledAmount;
    const transactionId = `#${String(createdAt).slice(-6)}`;

    return {
        id: transactionId,
        clientOrderKey,
        accountId,
        username,
        businessId,
        stallId: stallId ?? stallNumber ?? null,
        stallNumber: stallNumber ?? null,
        item: itemTitle,
        amount: formatCurrency(settledAmount),
        subtitle: `${itemCount} item${itemCount === 1 ? '' : 's'} • Paid ${formatCurrency(paidValue)}`,
        category,
        categories: categories.length > 0 ? categories : ['General'],
        categoryType: getCategoryType(category),
        dateLabel: formatTransactionDate(createdAt),
        createdAt,
        preparedAt,
        cartItems,
        paidAmount: paidValue,
        totalDue: settledAmount,
    };
};
