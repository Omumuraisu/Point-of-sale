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
    mergeLocalAndRemoteTransactions,
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

test('grouped remote orders expose item categories as ordered tags', async () => {
    const order = {
        order_id: 55,
        client_order_key: 'checkout:tags:1',
        total_due_php: 200,
        paid_amount_php: 200,
        change_amount_php: 0,
        completed_at: '2026-10-06T01:00:00.000Z',
    };
    const row = (transactionId: number, category: string, product: string) => ({
        transaction_id: transactionId,
        order_id: 55,
        business_id: 10,
        stall_id: 'STALL-1',
        stall_number: '1',
        account_id: 7,
        username: 'Vendor',
        category,
        product,
        quantity_sold_kg: 1,
        unit_price_php: 100,
        total_revenue_php: 100,
        transaction_date: '2026-10-06T01:00:00.000Z',
        product_listing_id: `listing-${transactionId}`,
        catalog_product_id: null,
        sold_quantity: 1,
        sold_unit: 'piece',
        sales_order: order,
    });
    mockQuery.order.mockResolvedValueOnce({
        data: [row(1, 'Meat', 'Pork'), row(2, 'Rice', 'Brown Rice')],
        error: null,
    });

    const records = await loadRemoteSalesTransactions({ businessId: 10 });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
        category: 'Meat',
        categories: ['Meat', 'Rice'],
    });
    expect(records[0].cartItems?.map((item) => item.category)).toEqual(['Meat', 'Rice']);
});

test('sale synchronization carries business_id in both RPC scope and row payload', async () => {
    const result = await syncTransactionRecordWithResult(transaction(), { accountId: 7, businessId: 10, stallNumber: '1' });

    expect(result.success).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('record_open_stall_sale', expect.objectContaining({
        p_business_id: 10,
        p_rows: [expect.objectContaining({ business_id: 10, stall_id: 'STALL-1' })],
    }));
});

test('mismatched active business prevents synchronization', async () => {
    const result = await syncTransactionRecordWithResult(transaction(), { accountId: 7, businessId: 20, stallNumber: '1' });

    expect(result).toMatchObject({ success: false });
    expect(result.error).toContain('businessId');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
});

test('offline retry reads and updates only the active account-business queue', async () => {
    mockGetUnsyncedTransactions.mockResolvedValue([transaction()]);

    await expect(syncUnsyncedTransactions({ accountId: 7, businessId: 10, stallNumber: '1' }))
        .resolves.toEqual({ attempted: 1, synced: 1 });
    expect(mockGetUnsyncedTransactions).toHaveBeenCalledWith({ accountId: 7, businessId: 10, stallNumber: '1' });
    expect(mockUpdateTransactionSyncState).toHaveBeenCalledWith(
        { accountId: 7, businessId: 10, stallNumber: '1' },
        '#local',
        expect.objectContaining({ synced: true, id: '#55', orderId: 55 }),
    );
});

test('cached synced sales remain visible offline and remote copies replace duplicates online', () => {
    const local = { ...transaction(), id: '#55', orderId: 55, synced: true };
    const remote = { ...local, item: 'Canonical Rice', syncedAt: 10 };

    expect(mergeLocalAndRemoteTransactions([local], [])).toEqual([local]);
    expect(mergeLocalAndRemoteTransactions([local], [remote])).toEqual([remote]);
});
