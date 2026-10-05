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

    const business10 = await loadSavedTransactions({ accountId: 7, businessId: 10 });
    const business20 = await loadSavedTransactions({ accountId: 7, businessId: 20 });

    expect(business10.map(({ id }) => id)).toEqual(['#business-10']);
    expect(business20.map(({ id }) => id)).toEqual(['#business-20']);
    expect(await AsyncStorage.getItem('@pos/sales-transactions:7')).not.toBeNull();
    expect(await AsyncStorage.getItem('@pos/sales-transactions:7:10')).not.toBeNull();
    expect(await AsyncStorage.getItem('@pos/sales-transactions:7:20')).not.toBeNull();
});

test('ambiguous legacy records are retained but never exposed to a business', async () => {
    const ambiguous = { ...transaction(7, 10, '#ambiguous'), businessId: undefined };
    await AsyncStorage.setItem('@pos/sales-transactions:7', JSON.stringify([ambiguous]));

    expect(await loadSavedTransactions({ accountId: 7, businessId: 10 })).toEqual([]);
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
    expect(await loadSavedTransactions({ accountId: 7, businessId: 10 })).toHaveLength(1);
    expect(await loadSavedTransactions({ accountId: 7, businessId: 20 })).toEqual([]);
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
