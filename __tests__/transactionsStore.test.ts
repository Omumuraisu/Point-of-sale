import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadSavedTransactions, saveReceiptTransaction } from '../src/components/pos/transactionsStore';
import { TransactionRecord } from '../src/lib/types';
import { syncTransactionRecordWithResult } from '../src/lib/transactionsSync';

jest.mock('@react-native-async-storage/async-storage', () => (
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
));

jest.mock('../src/lib/transactionsSync', () => ({
    syncTransactionRecordWithResult: jest.fn(),
}));

jest.mock('../src/lib/transactionSyncEvents', () => ({
    notifyTransactionSyncChanged: jest.fn(),
}));

const mockedSync = syncTransactionRecordWithResult as jest.MockedFunction<typeof syncTransactionRecordWithResult>;

const transaction = (accountId: number, businessId: number, id: string): TransactionRecord => ({
    id,
    accountId,
    businessId,
    stallId: 'STALL-1',
    stallNumber: '1',
    item: 'Rice',
    amount: '₱100.00',
    subtitle: '1 item',
    category: 'Dry Goods',
    categoryType: { key: 'dry', label: 'Dry' },
    dateLabel: 'Oct 6, 2026',
    createdAt: 1,
    cartItems: [{
        id: `${id}-item`,
        name: 'Rice',
        category: 'Dry Goods',
        productListingId: 'listing-1',
        quantity: 1,
        unit: 'kg',
        pricePerUnit: 100,
        total: 100,
        createdAt: 1,
    }],
    totalDue: 100,
    paidAmount: 100,
    synced: false,
});

beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
});

test('local transactions are isolated by account and business even on the same stall', async () => {
    await AsyncStorage.setItem('@pos/sales-transactions:7', JSON.stringify([
        transaction(7, 10, '#business-10'),
        transaction(7, 20, '#business-20'),
    ]));

    const business10 = await loadSavedTransactions({ accountId: 7, businessId: 10, stallNumber: '1' });
    const business20 = await loadSavedTransactions({ accountId: 7, businessId: 20, stallNumber: '1' });

    expect(business10.map(({ id }) => id)).toEqual(['#business-10']);
    expect(business20.map(({ id }) => id)).toEqual(['#business-20']);
    expect(await AsyncStorage.getItem('@pos/sales-transactions:7')).not.toBeNull();
    expect(await AsyncStorage.getItem('@pos/sales-transactions:v3:7:10:1')).not.toBeNull();
    expect(await AsyncStorage.getItem('@pos/sales-transactions:v3:7:20:1')).not.toBeNull();
});

test('ambiguous legacy records are retained but never exposed to a business', async () => {
    const ambiguous = { ...transaction(7, 10, '#ambiguous'), businessId: undefined };
    await AsyncStorage.setItem('@pos/sales-transactions:7', JSON.stringify([ambiguous]));

    expect(await loadSavedTransactions({ accountId: 7, businessId: 10, stallNumber: '1' })).toEqual([]);
    expect(await AsyncStorage.getItem('@pos/sales-transactions:7')).not.toBeNull();
});

test('a valid-business offline sale is saved only in its scoped queue', async () => {
    mockedSync.mockResolvedValue({ success: false, error: 'Network unavailable' });

    const result = await saveReceiptTransaction({
        cartItems: transaction(7, 10, '#new').cartItems!,
        paidAmount: 100,
        totalDue: 100,
        accountId: 7,
        businessId: 10,
        username: 'Owner',
        clientOrderKey: 'checkout:7:10:1',
        preparedAt: 1,
        stallId: 'STALL-1',
        stallNumber: '1',
    });

    expect(result.transaction).toMatchObject({ accountId: 7, businessId: 10, synced: false });
    expect(await loadSavedTransactions({ accountId: 7, businessId: 10, stallNumber: '1' })).toHaveLength(1);
    expect(await loadSavedTransactions({ accountId: 7, businessId: 20, stallNumber: '1' })).toEqual([]);
});

test('multi-category sales persist category tags in the offline queue', async () => {
    mockedSync.mockResolvedValue({ success: false, error: 'Network unavailable' });
    const meatItem = transaction(7, 10, '#meat').cartItems![0];
    const riceItem = {
        ...transaction(7, 10, '#rice').cartItems![0],
        id: 'rice-item',
        name: 'Rice',
        category: 'Rice',
    };

    const result = await saveReceiptTransaction({
        cartItems: [{ ...meatItem, category: 'Meat' }, riceItem],
        paidAmount: 200,
        totalDue: 200,
        accountId: 7,
        businessId: 10,
        username: 'Owner',
        clientOrderKey: 'checkout:tags:1',
        preparedAt: 1,
        stallId: 'STALL-1',
        stallNumber: '1',
    });

    expect(result.transaction).toMatchObject({
        category: 'Meat',
        categories: ['Meat', 'Rice'],
    });
    await expect(loadSavedTransactions({ accountId: 7, businessId: 10, stallNumber: '1' }))
        .resolves.toEqual([expect.objectContaining({ categories: ['Meat', 'Rice'] })]);
});

test('loading a legacy Mixed record recovers and persists tags from its cart items', async () => {
    const legacy = {
        ...transaction(7, 10, '#legacy-mixed'),
        category: 'Mixed',
        categoryType: { key: 'neutral', label: 'Neutral' },
        cartItems: [
            { ...transaction(7, 10, '#meat').cartItems![0], category: 'Meat' },
            { ...transaction(7, 10, '#rice').cartItems![0], id: 'rice-item', category: 'Rice' },
        ],
    };
    await AsyncStorage.setItem('@pos/sales-transactions:v3:7:10:1', JSON.stringify([legacy]));

    const loaded = await loadSavedTransactions({ accountId: 7, businessId: 10, stallNumber: '1' });

    expect(loaded[0]).toMatchObject({ category: 'Meat', categories: ['Meat', 'Rice'] });
    expect(await AsyncStorage.getItem('@pos/sales-transactions:v3:7:10:1'))
        .toContain('"categories":["Meat","Rice"]');
});

test('a sale is durable before its first network attempt and keeps its checkout key', async () => {
    mockedSync.mockImplementation(async (queued) => {
        expect(await AsyncStorage.getItem('@pos/sales-transactions:v3:7:10:1')).toContain(queued.clientOrderKey!);
        return { success: false, error: 'Network unavailable' };
    });

    const result = await saveReceiptTransaction({
        cartItems: transaction(7, 10, '#new').cartItems!, paidAmount: 100, totalDue: 100,
        accountId: 7, businessId: 10, username: 'Owner', clientOrderKey: 'checkout:durable:1',
        preparedAt: 1, stallId: 'STALL-1', stallNumber: '1',
    });

    expect(result.transaction?.clientOrderKey).toBe('checkout:durable:1');
});

test('transaction retention never discards unsynced sales', async () => {
    const queued = Array.from({ length: 105 }, (_, index) => transaction(7, 10, `#queued-${index}`));
    await AsyncStorage.setItem('@pos/sales-transactions:v3:7:10:1', JSON.stringify(queued));
    mockedSync.mockResolvedValue({ success: false, error: 'offline' });

    await saveReceiptTransaction({
        cartItems: transaction(7, 10, '#new').cartItems!, paidAmount: 100, totalDue: 100,
        accountId: 7, businessId: 10, username: 'Owner', clientOrderKey: 'checkout:retention:1',
        preparedAt: 1, stallId: 'STALL-1', stallNumber: '1',
    });

    expect(await loadSavedTransactions({ accountId: 7, businessId: 10, stallNumber: '1' })).toHaveLength(106);
});

test('missing business context fails before synchronization or local persistence', async () => {
    const result = await saveReceiptTransaction({
        cartItems: transaction(7, 10, '#new').cartItems!,
        paidAmount: 100,
        totalDue: 100,
        accountId: 7,
        businessId: 0,
        username: 'Owner',
        clientOrderKey: 'invalid',
        preparedAt: 1,
        stallId: 'STALL-1',
        stallNumber: '1',
    });

    expect(result.transaction).toBeNull();
    expect(result.error).toContain('businessId');
    expect(mockedSync).not.toHaveBeenCalled();
});
