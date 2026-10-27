import {
    getTransactionCategories,
    getTransactionCategoryOptions,
    normalizeCategoryTags,
    transactionHasCategory,
} from '../src/lib/transactionCategories';
import { CartItem, TransactionRecord } from '../src/lib/types';
import { isTransactionRecord, toTransaction } from '../src/lib/utils';

const cartItem = (id: string, category: string): CartItem => ({
    id,
    name: `Item ${id}`,
    category,
    productListingId: `listing-${id}`,
    quantity: 1,
    unit: 'piece',
    pricePerUnit: 100,
    total: 100,
    createdAt: 1,
});

const transaction = (overrides: Partial<TransactionRecord> = {}): TransactionRecord => ({
    id: '#1',
    item: 'Items',
    amount: 'P200',
    subtitle: '2 items',
    category: 'Mixed',
    categoryType: { key: 'neutral', label: 'Neutral' },
    dateLabel: 'Oct 25, 2026',
    createdAt: 1,
    cartItems: [cartItem('meat', 'Meat'), cartItem('rice', 'Rice')],
    ...overrides,
});

test('normalizes category tags case-insensitively in first-seen order', () => {
    expect(normalizeCategoryTags([' Meat ', 'rice', 'MEAT', '', '  Dry   Goods  '])).toEqual([
        'Meat',
        'rice',
        'Dry Goods',
    ]);
});

test('new transactions save every unique cart category without using Mixed', () => {
    const saved = toTransaction({
        cartItems: [
            cartItem('meat', 'Meat'),
            cartItem('rice', 'Rice'),
            cartItem('meat-2', ' meat '),
        ],
        paidAmount: 300,
        totalDue: 300,
        createdAt: 1,
        accountId: 7,
        username: 'Owner',
        clientOrderKey: 'checkout:tags:1',
        preparedAt: 1,
        businessId: 10,
        stallId: 'STALL-1',
        stallNumber: '1',
    });

    expect(saved.categories).toEqual(['Meat', 'Rice']);
    expect(saved.category).toBe('Meat');
    expect(saved.categoryType).toEqual({ key: 'meat', label: 'Meat' });
});

test('recovers legacy Mixed tags from cart items and preserves unrecoverable Mixed records', () => {
    expect(getTransactionCategories(transaction())).toEqual(['Meat', 'Rice']);
    expect(getTransactionCategories(transaction({ cartItems: undefined }))).toEqual(['Mixed']);
});

test('builds flattened tag filters and matches any transaction category', () => {
    const tagged = transaction({ categories: ['Meat', 'Rice'], category: 'Meat' });
    const dry = transaction({
        categories: ['Dry Goods'],
        category: 'Dry Goods',
        cartItems: [cartItem('dry', 'Dry Goods')],
    });

    expect(getTransactionCategoryOptions([tagged, dry])).toEqual(['Meat', 'Rice', 'Dry Goods']);
    expect(transactionHasCategory(tagged, 'rice')).toBe(true);
    expect(transactionHasCategory(tagged, 'Dry Goods')).toBe(false);
    expect(transactionHasCategory(tagged, 'All')).toBe(true);
});

test('validation accepts legacy and tagged records but rejects invalid tag arrays', () => {
    expect(isTransactionRecord(transaction())).toBe(true);
    expect(isTransactionRecord(transaction({ categories: ['Meat', 'Rice'] }))).toBe(true);
    expect(isTransactionRecord({ ...transaction(), categories: ['Meat', ''] })).toBe(false);
});
