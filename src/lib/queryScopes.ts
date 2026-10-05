interface FilterQuery {
    eq: (column: string, value: unknown) => FilterQuery;
}

export const applyNotificationScope = <T>(query: T, accountId: number): T => (
    (query as unknown as FilterQuery)
        .eq('recipient_account_id', accountId)
        .eq('recipient_type', 'business_owner') as unknown as T
);

export const applyBillingScope = <T>(
    query: T,
    scope: { businessOwnerId: number; businessId: number; stallNumber: string },
): T => (
    (query as unknown as FilterQuery)
        .eq('business_owner_id', scope.businessOwnerId)
        .eq('business_id', scope.businessId)
        .eq('stall_number', scope.stallNumber) as unknown as T
);
