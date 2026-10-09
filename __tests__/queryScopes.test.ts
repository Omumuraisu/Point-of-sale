import { applyNotificationScope } from '../src/lib/queryScopes';

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

