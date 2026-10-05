import type { TransactionRecord } from '../src/lib/types';

const mockQuery = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
};
const mockSupabase = {
    from: jest.fn(),
    rpc: jest.fn(),
};
const mockGetUnsyncedTransactions = jest.fn();
const mockUpdateTransactionSyncState = jest.fn();

jest.doMock('../src/lib/supabase', () => ({
    isSupabaseConfigured: true,
    supabase: mockSupabase,
}));

jest.doMock('../src/components/pos/transactionsStore', () => ({
    getUnsyncedTransactions: mockGetUnsyncedTransactions,
    updateTransactionSyncState: mockUpdateTransactionSyncState,
}));

jest.doMock('../src/lib/debugLogging', () => ({
    debugError: jest.fn(),
    debugLog: jest.fn(),
}));

jest.doMock('../src/lib/transactionSyncEvents', () => ({
    notifyTransactionSyncChanged: jest.fn(),
}));

const {
    loadRemoteSalesTransactions,
    syncTransactionRecordWithResult,
    syncUnsyncedTransactions,
} = require('../src/lib/transactionsSync') as typeof import('../src/lib/transactionsSync');

const transaction = (): TransactionRecord => ({
    id: '#local',
    accountId: 7,
    businessId: 10,
    username: 'Vendor',
    stallId: 'STALL-1',
    stallNumber: '1',
    item: 'Rice',
    amount: '₱100.00',
    subtitle: '1 item',
    category: 'Dry Goods',
    categoryType: { key: 'dry', label: 'Dry' },
    dateLabel: 'Oct 6, 2026',
    createdAt: 1,
    clientOrderKey: 'checkout:7:10:1',
    cartItems: [{
        id: 'item-1',
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

beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
    mockQuery.order.mockResolvedValue({ data: [], error: null });
    mockSupabase.from.mockReturnValue(mockQuery);
    mockSupabase.rpc.mockResolvedValue({
        data: {
            order_id: 55,
            completed_at: '2026-10-06T01:00:00.000Z',
            total_due_php: 100,
            paid_amount_php: 100,
            change_amount_php: 0,
        },
        error: null,
    });
});

test('remote sales use business_id as the only ownership filter', async () => {
    await loadRemoteSalesTransactions({ businessId: 10 });

    expect(mockSupabase.from).toHaveBeenCalledWith('sales_transaction');
    expect(mockQuery.eq).toHaveBeenCalledTimes(1);
    expect(mockQuery.eq).toHaveBeenCalledWith('business_id', 10);
    expect(mockQuery.eq).not.toHaveBeenCalledWith('stall_id', expect.anything());
    expect(mockQuery.eq).not.toHaveBeenCalledWith('account_id', expect.anything());
});

test('owner and vendor requests for the same business use the same remote scope', async () => {
    await loadRemoteSalesTransactions({ businessId: 10 });
    await loadRemoteSalesTransactions({ businessId: 10 });

    expect(mockQuery.eq).toHaveBeenNthCalledWith(1, 'business_id', 10);
    expect(mockQuery.eq).toHaveBeenNthCalledWith(2, 'business_id', 10);
});

test('invalid business context returns no sales without querying Supabase', async () => {
    await expect(loadRemoteSalesTransactions({ businessId: 0 })).resolves.toEqual([]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
});

test('sale synchronization carries business_id in both RPC scope and row payload', async () => {
    const result = await syncTransactionRecordWithResult(transaction(), { accountId: 7, businessId: 10 });

    expect(result.success).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('record_open_stall_sale', expect.objectContaining({
        p_business_id: 10,
        p_rows: [expect.objectContaining({ business_id: 10, stall_id: 'STALL-1' })],
    }));
});

test('mismatched active business prevents synchronization', async () => {
    const result = await syncTransactionRecordWithResult(transaction(), { accountId: 7, businessId: 20 });

    expect(result).toMatchObject({ success: false });
    expect(result.error).toContain('businessId');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
});

test('offline retry reads and updates only the active account-business queue', async () => {
    mockGetUnsyncedTransactions.mockResolvedValue([transaction()]);

    await expect(syncUnsyncedTransactions({ accountId: 7, businessId: 10 }))
        .resolves.toEqual({ attempted: 1, synced: 1 });
    expect(mockGetUnsyncedTransactions).toHaveBeenCalledWith({ accountId: 7, businessId: 10 });
    expect(mockUpdateTransactionSyncState).toHaveBeenCalledWith(
        { accountId: 7, businessId: 10 },
        '#local',
        expect.objectContaining({ synced: true }),
    );
});
