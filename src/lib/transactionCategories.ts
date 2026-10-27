import { TransactionRecord } from './types';

export const normalizeCategoryTags = (values: unknown[]): string[] => {
    const seen = new Set<string>();
    const tags: string[] = [];

    values.forEach((value) => {
        if (typeof value !== 'string') return;

        const tag = value.trim().replace(/\s+/g, ' ');
        const key = tag.toLowerCase();

        if (!tag || seen.has(key)) return;

        seen.add(key);
        tags.push(tag);
    });

    return tags;
};

export const getTransactionCategories = (
    transaction: Pick<TransactionRecord, 'categories' | 'cartItems' | 'category'>,
): string[] => {
    const storedTags = normalizeCategoryTags(transaction.categories ?? []);
    if (storedTags.length > 0) return storedTags;

    const itemTags = normalizeCategoryTags(
        transaction.cartItems?.map((item) => item.category) ?? [],
    );
    if (itemTags.length > 0) return itemTags;

    const legacyTags = normalizeCategoryTags([transaction.category]);
    return legacyTags.length > 0 ? legacyTags : ['General'];
};

export const transactionHasCategory = (
    transaction: Pick<TransactionRecord, 'categories' | 'cartItems' | 'category'>,
    category: string,
): boolean => {
    const normalizedCategory = category.trim().toLowerCase();
    return normalizedCategory === 'all'
        || getTransactionCategories(transaction).some((tag) => tag.toLowerCase() === normalizedCategory);
};

export const getTransactionCategoryOptions = (
    transactions: Array<Pick<TransactionRecord, 'categories' | 'cartItems' | 'category'>>,
): string[] => normalizeCategoryTags(
    transactions.flatMap((transaction) => getTransactionCategories(transaction)),
);
