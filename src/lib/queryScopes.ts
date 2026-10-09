interface FilterQuery {
    eq: (column: string, value: unknown) => FilterQuery;
}

export const applyNotificationScope = <T>(query: T, accountId: number): T => (
    (query as unknown as FilterQuery)
        .eq('recipient_account_id', accountId)
        .eq('recipient_type', 'business_owner') as unknown as T
);

