import { applyBillingScope, applyNotificationScope } from '../src/lib/queryScopes';

const makeQuery = () => {
    const query = { eq: jest.fn() };
    query.eq.mockReturnValue(query);
    return query;
};

test('notifications are always scoped to the signed-in owner account', () => {
    const query = makeQuery();
    applyNotificationScope(query, 77);
    expect(query.eq).toHaveBeenNthCalledWith(1, 'recipient_account_id', 77);
    expect(query.eq).toHaveBeenNthCalledWith(2, 'recipient_type', 'business_owner');
});

test('bill balances are scoped to owner, business, and stall', () => {
    const query = makeQuery();
    applyBillingScope(query, { businessOwnerId: 20, businessId: 30, stallNumber: 'A-1' });
    expect(query.eq).toHaveBeenNthCalledWith(1, 'business_owner_id', 20);
    expect(query.eq).toHaveBeenNthCalledWith(2, 'business_id', 30);
    expect(query.eq).toHaveBeenNthCalledWith(3, 'stall_number', 'A-1');
});
