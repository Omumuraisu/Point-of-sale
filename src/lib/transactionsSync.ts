import { CartItem, TransactionRecord, TransactionScope } from './types';
import { isSupabaseConfigured, supabase } from './supabase';
import { getUnsyncedTransactions, updateTransactionSyncState } from '../components/pos/transactionsStore';
import { formatCurrency, formatTransactionDate, getCategoryType } from './utils';
import { notifyTransactionSyncChanged } from './transactionSyncEvents';
import { debugError, debugLog } from './debugLogging';

interface SalesTransactionRow {
    transaction_id: number;
    order_id: number | null;
    business_id: number;
    stall_id: string;
    stall_number: string | null;
    account_id: number;
    username: string;
    category: string;
    product: string;
    quantity_sold_kg: number;
    unit_price_php: number;
    total_revenue_php: number;
    transaction_date: string;
    product_listing_id: string | null;
    catalog_product_id: string | null;
    sold_quantity: number | null;
    sold_unit: string | null;
    sales_order: SalesOrderRow | SalesOrderRow[] | null;
}

interface SalesOrderRow {
    order_id: number;
    client_order_key: string;
    total_due_php: number;
    paid_amount_php: number;
    change_amount_php: number;
    completed_at: string;
}

interface TransactionSyncResult {
    success: boolean;
    error?: string;
    order?: {
        orderId: number;
        completedAt: number;
        totalDue: number;
        paidAmount: number;
        changeAmount: number;
    };
}

const logSyncDebug = (event: string, details?: Record<string, unknown>) => {
    debugLog('transactions-payments', event, details);
};

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return 'Unknown Supabase sync error';
};

const getUnitPrice = (item: CartItem): number => {
    if (Number.isFinite(item.pricePerUnit)) {
        return item.pricePerUnit;
    }
    if (Number.isFinite(item.pricePerKg)) {
        return item.pricePerKg as number;
    }

    if (Number.isFinite(item.quantity) && item.quantity > 0 && Number.isFinite(item.total)) {
        return item.total / item.quantity;
    }

    return 0;
};

const logSyncError = (event: string, details: Record<string, unknown>) => {
    debugError('transactions-payments', event, details);
};

const toTimestamp = (value: string): number => {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : Date.now();
};

const getSalesOrder = (row: SalesTransactionRow): SalesOrderRow | null => (
    Array.isArray(row.sales_order) ? row.sales_order[0] ?? null : row.sales_order
);

const toCartItem = (row: SalesTransactionRow): CartItem => {
    const createdAt = toTimestamp(row.transaction_date);
    const quantity = Number(row.sold_quantity ?? row.quantity_sold_kg) || 0;
    const unitPrice = Number(row.unit_price_php) || 0;
    const total = Number(row.total_revenue_php) || quantity * unitPrice;
    return {
        id: `sales-item-${row.transaction_id}`,
        name: row.product,
        category: row.category,
        productListingId: row.product_listing_id ?? '',
        catalogProductId: row.catalog_product_id ?? undefined,
        quantity,
        unit: row.sold_unit ?? 'kg',
        pricePerUnit: unitPrice,
        total,
        createdAt,
    };
};

const toTransactionRecord = (row: SalesTransactionRow): TransactionRecord => {
    const createdAt = toTimestamp(row.transaction_date);
    const cartItem = toCartItem(row);
    const total = cartItem.total;
    const quantity = cartItem.quantity;
    const unitPrice = cartItem.pricePerUnit;

    return {
        id: `#${row.transaction_id}`,
        accountId: row.account_id,
        businessId: row.business_id,
        username: row.username,
        stallId: row.stall_id,
        stallNumber: row.stall_number,
        item: row.product,
        amount: formatCurrency(total),
        subtitle: `${quantity} ${row.sold_unit ?? 'kg'} • ${formatCurrency(unitPrice)}/${row.sold_unit ?? 'kg'}`,
        category: row.category,
        categoryType: getCategoryType(row.category),
        dateLabel: formatTransactionDate(createdAt),
        createdAt,
        cartItems: [cartItem],
        paidAmount: total,
        totalDue: total,
        synced: true,
        syncedAt: Date.now(),
        syncAttempts: 0,
    };
};

const toOrderTransactionRecord = (rows: SalesTransactionRow[]): TransactionRecord => {
    const first = rows[0];
    const order = getSalesOrder(first);
    const cartItems = rows.map(toCartItem);
    const completedAt = toTimestamp(order?.completed_at ?? first.transaction_date);
    const calculatedTotal = cartItems.reduce((sum, item) => sum + item.total, 0);
    const totalDue = Number(order?.total_due_php ?? calculatedTotal) || calculatedTotal;
    const paidAmount = Number(order?.paid_amount_php ?? totalDue) || totalDue;
    const categories = Array.from(new Set(cartItems.map((item) => item.category).filter(Boolean)));
    const category = categories.length === 1 ? categories[0] : 'Mixed';
    const firstItem = cartItems[0];
    const item = cartItems.length > 1 ? `${firstItem.name} +${cartItems.length - 1} more` : firstItem.name;

    return {
        id: `#${order?.order_id ?? first.order_id}`,
        orderId: order?.order_id ?? first.order_id ?? undefined,
        clientOrderKey: order?.client_order_key,
        accountId: first.account_id,
        businessId: first.business_id,
        username: first.username,
        stallId: first.stall_id,
        stallNumber: first.stall_number,
        item,
        amount: formatCurrency(totalDue),
        subtitle: `${cartItems.length} item${cartItems.length === 1 ? '' : 's'} • Paid ${formatCurrency(paidAmount)}`,
        category,
        categoryType: getCategoryType(category),
        dateLabel: formatTransactionDate(completedAt),
        createdAt: completedAt,
        completedAt,
        cartItems,
        paidAmount,
        totalDue,
        changeAmount: Number(order?.change_amount_php ?? Math.max(paidAmount - totalDue, 0)),
        synced: true,
        syncedAt: Date.now(),
        syncAttempts: 0,
    };
};

const toSalesTransactionRows = (transaction: TransactionRecord) => {
    const cartItems = transaction.cartItems ?? [];
    const accountId = transaction.accountId;
    const stallId = transaction.stallId ?? transaction.stallNumber;

    if (!accountId || !transaction.businessId || !stallId || cartItems.length === 0) {
        return [];
    }

    const transactionDate = new Date(transaction.createdAt).toISOString();

    return cartItems.map((item) => ({
        business_id: transaction.businessId,
        stall_id: stallId,
        stall_number: transaction.stallNumber ?? stallId,
        account_id: accountId,
        username: transaction.username ?? '',
        category: item.category || transaction.category,
        product: item.name,
        product_listing_id: item.productListingId || null,
        catalog_product_id: item.catalogProductId ?? null,
        quantity_sold_kg: item.quantity,
        sold_quantity: item.quantity,
        sold_unit: item.unit,
        unit_price_php: getUnitPrice(item),
        transaction_date: transactionDate,
        sync_date: new Date().toISOString(),
    }));
};

const getMissingSyncFields = (transaction: TransactionRecord): string[] => {
    const missingFields: string[] = [];

    if (!transaction.accountId) {
        missingFields.push('accountId');
    }

    if (!transaction.businessId) {
        missingFields.push('businessId');
    }

    if (!(transaction.stallId ?? transaction.stallNumber)) {
        missingFields.push('stallId/stallNumber');
    }

    if (!transaction.cartItems || transaction.cartItems.length === 0) {
        missingFields.push('cartItems');
    }

    return missingFields;
};

export const syncTransactionRecordWithResult = async (
    transaction: TransactionRecord,
    scope: TransactionScope,
): Promise<TransactionSyncResult> => {
    if (
        !Number.isInteger(scope.accountId)
        || scope.accountId <= 0
        || !Number.isInteger(scope.businessId)
        || scope.businessId <= 0
        || transaction.accountId !== scope.accountId
        || transaction.businessId !== scope.businessId
    ) {
        const error = 'Transaction synchronization requires a valid, matching accountId and businessId.';
        logSyncError('transaction scope mismatch', {
            transactionId: transaction.id,
            transactionAccountId: transaction.accountId,
            transactionBusinessId: transaction.businessId,
            scope,
        });
        return { success: false, error };
    }

    if (!isSupabaseConfigured || !supabase) {
        return {
            success: false,
            error: 'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.',
        };
    }

    try {
        const transactionForSync = transaction;
        const rows = toSalesTransactionRows(transactionForSync);

        if (rows.length === 0) {
            const missingFields = getMissingSyncFields(transactionForSync);
            const errorMessage = `Transaction is missing required sync fields: ${missingFields.join(', ') || 'unknown'}.`;

            logSyncError('transaction missing required sync fields', {
                transactionId: transactionForSync.id,
                accountId: transactionForSync.accountId,
                stallId: transactionForSync.stallId,
                stallNumber: transactionForSync.stallNumber,
                businessId: transactionForSync.businessId,
                cartItemsCount: transactionForSync.cartItems?.length ?? 0,
                missingFields,
            });

            return {
                success: false,
                error: errorMessage,
            };
        }

        logSyncDebug('attempting sales_transaction insert', {
            transactionId: transaction.id,
            rowCount: rows.length,
        });

        if (!transactionForSync.businessId) {
            return { success: false, error: 'Transaction is missing required sync fields: businessId.' };
        }

        const clientOrderKey = transactionForSync.clientOrderKey
            ?? `legacy:${transactionForSync.accountId}:${transactionForSync.businessId}:${transactionForSync.createdAt}:${transactionForSync.id}`;
        const paidAmount = transactionForSync.paidAmount ?? transactionForSync.totalDue ?? 0;
        const { data, error } = await supabase.rpc('record_open_stall_sale', {
            p_business_id: transactionForSync.businessId,
            p_client_order_key: clientOrderKey,
            p_paid_amount: paidAmount,
            p_rows: rows,
        });

        if (error) {
            logSyncError('sales_transaction insert failed', {
                transactionId: transaction.id,
                errorMessage: error.message,
                errorDetails: error.details,
                errorHint: error.hint,
                errorCode: error.code,
                rowCount: rows.length,
            });

            return {
                success: false,
                error: error.message.includes('STALL_CLOSED')
                    ? 'Open the stall before starting a sale.'
                    : /fetch|network/i.test(error.message)
                        ? 'Unable to reach the server. Check your connection and try again.'
                    : [
                    error.message,
                    error.details,
                    error.hint,
                    error.code ? `Code: ${error.code}` : undefined,
                    ].filter(Boolean).join(' | '),
            };
        }

        const response = (Array.isArray(data) ? data[0] : data) as {
            order_id?: number;
            completed_at?: string;
            total_due_php?: number;
            paid_amount_php?: number;
            change_amount_php?: number;
        } | null;

        if (!response?.order_id || !response.completed_at) {
            return { success: false, error: 'The server recorded no order metadata. Please try again.' };
        }

        logSyncDebug('transaction synced', { transactionId: transaction.id, orderId: response.order_id });

        return {
            success: true,
            order: {
                orderId: Number(response.order_id),
                completedAt: toTimestamp(response.completed_at),
                totalDue: Number(response.total_due_php ?? transactionForSync.totalDue ?? 0),
                paidAmount: Number(response.paid_amount_php ?? paidAmount),
                changeAmount: Number(response.change_amount_php ?? 0),
            },
        };
    } catch (error) {
        logSyncError('sales_transaction sync threw exception', {
            transactionId: transaction.id,
            error,
        });

        return {
            success: false,
            error: /fetch|network/i.test(getErrorMessage(error))
                ? 'Unable to reach the server. Check your connection and try again.'
                : getErrorMessage(error),
        };
    }
};

export const syncTransactionRecord = async (
    transaction: TransactionRecord,
    scope: TransactionScope,
): Promise<boolean> => {
    const result = await syncTransactionRecordWithResult(transaction, scope);
    return result.success;
};

interface SalesTransactionScope {
    businessId: number;
}

export const loadRemoteSalesTransactions = async ({
    businessId,
}: SalesTransactionScope): Promise<TransactionRecord[]> => {
    if (!Number.isInteger(businessId) || businessId <= 0) {
        debugError('transactions-payments', 'cannot load remote sales without a valid businessId', { businessId });
        return [];
    }

    if (!isSupabaseConfigured || !supabase) {
        return [];
    }

    let query = supabase
        .from('sales_transaction')
        .select('transaction_id, order_id, business_id, stall_id, stall_number, account_id, username, category, product, quantity_sold_kg, unit_price_php, total_revenue_php, transaction_date, product_listing_id, catalog_product_id, sold_quantity, sold_unit, sales_order(order_id, client_order_key, total_due_php, paid_amount_php, change_amount_php, completed_at)')
        .eq('business_id', businessId)
        .order('transaction_date', { ascending: false });

    const { data, error } = await query;

    if (error || !data) {
        if (error) {
            debugError('transactions-payments', 'failed to load remote sales transactions', { message: error.message });
        }

        return [];
    }

    const rows = data as unknown as SalesTransactionRow[];
    const groupedRows = new Map<number, SalesTransactionRow[]>();
    const legacyTransactions: TransactionRecord[] = [];

    rows.forEach((row) => {
        if (!row.order_id) {
            legacyTransactions.push(toTransactionRecord(row));
            return;
        }
        const existing = groupedRows.get(row.order_id) ?? [];
        existing.push(row);
        groupedRows.set(row.order_id, existing);
    });

    return [
        ...Array.from(groupedRows.values()).map(toOrderTransactionRecord),
        ...legacyTransactions,
    ].sort((first, second) => second.createdAt - first.createdAt);
};

export const syncUnsyncedTransactions = async (scope?: TransactionScope | null): Promise<{ attempted: number; synced: number }> => {
    if (!isSupabaseConfigured || !supabase) {
        return { attempted: 0, synced: 0 };
    }

    if (!scope || !Number.isInteger(scope.accountId) || scope.accountId <= 0
        || !Number.isInteger(scope.businessId) || scope.businessId <= 0) {
        logSyncError('cannot synchronize queued sales without a valid business scope', { scope });
        return { attempted: 0, synced: 0 };
    }

    const unsyncedTransactions = await getUnsyncedTransactions(scope);
    let synced = 0;

    for (const transaction of unsyncedTransactions) {
        const result = await syncTransactionRecordWithResult(transaction, scope);
        const nextAttempts = (transaction.syncAttempts ?? 0) + 1;

        if (result.success) {
            synced += 1;
            await updateTransactionSyncState(scope, transaction.id, {
                synced: true,
                syncedAt: Date.now(),
                syncError: undefined,
                syncAttempts: nextAttempts,
            });
        } else {
            logSyncError('batch transaction sync failed', {
                transactionId: transaction.id,
                accountId: scope.accountId,
                businessId: scope.businessId,
                error: result.error,
                transactionAccountId: transaction.accountId,
                transactionBusinessId: transaction.businessId,
                transactionStallId: transaction.stallId,
                transactionStallNumber: transaction.stallNumber,
                cartItemsCount: transaction.cartItems?.length ?? 0,
            });

            await updateTransactionSyncState(scope, transaction.id, {
                synced: false,
                syncError: result.error,
                syncAttempts: nextAttempts,
            });
        }
    }

    logSyncDebug('batch complete', {
        attempted: unsyncedTransactions.length,
        synced,
    });

    if (unsyncedTransactions.length > 0) {
        notifyTransactionSyncChanged();
    }

    return {
        attempted: unsyncedTransactions.length,
        synced,
    };
};
