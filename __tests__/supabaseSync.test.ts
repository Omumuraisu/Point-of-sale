import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => (
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
));

const mockSyncProducts = jest.fn();
const mockGetProductSummary = jest.fn();
const mockGetAliases = jest.fn();
const mockSyncTransactions = jest.fn();
const mockGetUnsynced = jest.fn();

jest.mock('../src/components/pos/productsStore', () => ({
    syncProducts: (...args: unknown[]) => mockSyncProducts(...args),
    getProductSyncSummary: (...args: unknown[]) => mockGetProductSummary(...args),
    getListingIdAliases: (...args: unknown[]) => mockGetAliases(...args),
}));
jest.mock('../src/lib/transactionsSync', () => ({
    syncUnsyncedTransactions: (...args: unknown[]) => mockSyncTransactions(...args),
}));
jest.mock('../src/components/pos/transactionsStore', () => ({
    getUnsyncedTransactions: (...args: unknown[]) => mockGetUnsynced(...args),
    reconcileUnsyncedTransactionListingIds: jest.fn(),
}));
jest.mock('../src/components/pos/cartStore', () => ({ reconcileCartListingIds: jest.fn() }));
jest.mock('../src/lib/debugLogging', () => ({ debugLog: jest.fn() }));

import { getDatabaseSyncStatus, syncAllSupabaseData } from '../src/lib/supabaseSync';

const scope = { accountId: 7, businessId: 10, stallNumber: '1' };

beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockGetAliases.mockResolvedValue({});
    mockGetUnsynced.mockResolvedValue([]);
    mockGetProductSummary.mockResolvedValue({ attempted: 0, synced: 0, failed: 0, pending: 0 });
    mockSyncTransactions.mockResolvedValue({ attempted: 0, synced: 0 });
    mockSyncProducts.mockResolvedValue({ attempted: 0, synced: 0, failed: 0, pending: 0 });
});

test('concurrent triggers share one serialized sync operation', async () => {
    let finish!: (value: { attempted: number; synced: number; failed: number; pending: number }) => void;
    mockSyncProducts.mockReturnValue(new Promise((resolve) => { finish = resolve; }));

    const first = syncAllSupabaseData(scope);
    const second = syncAllSupabaseData(scope);
    expect(second).toBe(first);
    expect(mockSyncProducts).toHaveBeenCalledTimes(1);

    finish({ attempted: 0, synced: 0, failed: 0, pending: 0 });
    await first;
    expect(mockSyncTransactions).toHaveBeenCalledTimes(1);
});

test('last-success timestamp is written only when every queue is empty', async () => {
    await syncAllSupabaseData(scope);
    expect((await getDatabaseSyncStatus(scope)).lastSyncedAt).toEqual(expect.any(Number));

    await AsyncStorage.clear();
    mockSyncProducts.mockResolvedValue({ attempted: 1, synced: 0, failed: 1, pending: 0, error: 'offline' });
    mockGetProductSummary.mockResolvedValue({ attempted: 0, synced: 0, failed: 1, pending: 0 });
    const result = await syncAllSupabaseData(scope);
    const status = await getDatabaseSyncStatus(scope);

    expect(result.products).toMatchObject({ failed: 1, remaining: 1 });
    expect(status).toMatchObject({ queued: 1, failed: 1, lastSyncedAt: null, lastError: 'offline' });
});
