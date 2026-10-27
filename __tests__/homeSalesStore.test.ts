import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    loadHomeSalesCache,
    pruneHomeSalesTransactions,
    saveHomeSalesCache,
} from '../src/components/home/homeSalesStore';
import { TransactionRecord, TransactionScope } from '../src/lib/types';

jest.mock('@react-native-async-storage/async-storage', () => (
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
));

jest.mock('../src/lib/debugLogging', () => ({
    debugError: jest.fn(), debugWarn: jest.fn(),
}));

const scope: TransactionScope = { accountId: 7, businessId: 10, stallNumber: '1' };
const transaction = (id: string, createdAt: number): TransactionRecord => ({
    id,
    accountId: scope.accountId,
    businessId: scope.businessId,
    stallId: 'STALL-1',
    stallNumber: scope.stallNumber,
    item: `Sale ${id}`,
    amount: '₱100.00',
    subtitle: '1 item',
    category: 'General',
    categoryType: { key: 'general', label: 'General' },
    dateLabel: 'Oct 22, 2026',
    createdAt,
    totalDue: 100,
    paidAmount: 100,
    synced: true,
});

beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
});

test('homepage sales cache is isolated by account, business, and stall', async () => {
    const now = new Date(2026, 9, 22, 12).getTime();
    await saveHomeSalesCache(scope, [transaction('cached', now)]);

    expect((await loadHomeSalesCache(scope)).map((item) => item.id)).toEqual(['cached']);
    expect(await loadHomeSalesCache({ ...scope, businessId: 20 })).toEqual([]);
});

test('homepage cache retains current and previous day sales plus three latest older sales', () => {
    const now = new Date(2026, 9, 22, 12);
    const today = new Date(2026, 9, 22, 9).getTime();
    const yesterday = new Date(2026, 9, 21, 9).getTime();
    const older = [18, 17, 16, 15].map((day) => transaction(`old-${day}`, new Date(2026, 9, day, 9).getTime()));

    const retained = pruneHomeSalesTransactions([
        transaction('today', today),
        transaction('yesterday', yesterday),
        ...older,
    ], now);

    expect(retained.map((item) => item.id)).toEqual(['today', 'yesterday', 'old-18']);
});

test('saved homepage sales survive a cold cache read in newest-first order', async () => {
    const now = Date.now();
    await saveHomeSalesCache(scope, [transaction('older', now - 1000), transaction('newer', now)]);

    expect((await loadHomeSalesCache(scope)).map((item) => item.id)).toEqual(['newer', 'older']);
});
