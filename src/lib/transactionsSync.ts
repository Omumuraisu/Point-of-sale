import { CartItem, TransactionRecord } from './types';
import { isSupabaseConfigured, supabase } from './supabase';
import { getUnsyncedTransactions, updateTransactionSyncState } from '../components/pos/transactionsStore';
import { formatCurrency, formatTransactionDate, getCategoryType } from './utils';
import { notifyTransactionSyncChanged } from './transactionSyncEvents';

interface SalesTransactionRow {
    transaction_id: number;
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
}

interface TransactionSyncResult {
    success: boolean;
    error?: string;
}

interface OwnerContextRow {
    business_owner_id: number;
}

interface VendorContextRow {
    vendor_id: number;
    business_owner_id: number;
}

interface BusinessContextRow {
    business_id: number;
    stall_id: string | null;
    stall_number: string | null;
    stall_no: string | null;
}

interface StallContextRow {
    stall_id: string | null;
    stall_number: string;
}

interface TransactionContext {
    businessId: number | null;
    stallId: string | null;
    stallNumber: string | null;
}

let lastContextResolutionError: string | null = null;
let lastContextResolutionDetails: Record<string, unknown> | null = null;

const logSyncDebug = (event: string, details?: Record<string, unknown>) => {
    if (!__DEV__) {
        return;
    }

    if (details) {
        console.log(`[SUPABASE_SYNC] ${event}`, details);
        return;
    }

    console.log(`[SUPABASE_SYNC] ${event}`);
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
    if (Number.isFinite(item.pricePerKg)) {
        return item.pricePerKg;
    }

    if (Number.isFinite(item.quantity) && item.quantity > 0 && Number.isFinite(item.total)) {
        return item.total / item.quantity;
    }

    return 0;
};

const logSyncError = (event: string, details: Record<string, unknown>) => {
    if (!__DEV__) {
        return;
    }

    console.error(`[SUPABASE_SYNC_ERROR] ${event}`, details);
};

const toTimestamp = (value: string): number => {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : Date.now();
};

const toTransactionRecord = (row: SalesTransactionRow): TransactionRecord => {
    const createdAt = toTimestamp(row.transaction_date);
    const quantity = Number(row.quantity_sold_kg) || 0;
    const unitPrice = Number(row.unit_price_php) || 0;
    const total = Number(row.total_revenue_php) || quantity * unitPrice;
    const cartItem: CartItem = {
        id: `sales-item-${row.transaction_id}`,
        name: row.product,
        category: row.category,
        quantity,
        unit: 'kg',
        pricePerKg: unitPrice,
        total,
        createdAt,
    };

    return {
        id: `#${row.transaction_id}`,
        accountId: row.account_id,
        username: row.username,
        stallId: row.stall_id,
        stallNumber: row.stall_number,
        item: row.product,
        amount: formatCurrency(total),
        subtitle: `${quantity} kg • ${formatCurrency(unitPrice)}/kg`,
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

const toSalesTransactionRows = (transaction: TransactionRecord) => {
    const cartItems = transaction.cartItems ?? [];
    const accountId = transaction.accountId;
    const stallId = transaction.stallId ?? transaction.stallNumber;

    if (!accountId || !stallId || cartItems.length === 0) {
        return [];
    }

    const transactionDate = new Date(transaction.createdAt).toISOString();

    return cartItems.map((item) => ({
        stall_id: stallId,
        stall_number: transaction.stallNumber ?? stallId,
        account_id: accountId,
        username: transaction.username ?? '',
        category: item.category || transaction.category,
        product: item.name,
        quantity_sold_kg: item.quantity,
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

    if (!(transaction.stallId ?? transaction.stallNumber)) {
        missingFields.push('stallId/stallNumber');
    }

    if (!transaction.cartItems || transaction.cartItems.length === 0) {
        missingFields.push('cartItems');
    }

    return missingFields;
};

const resolveBusinessOwnerId = async (accountId: number): Promise<number | null> => {
    if (!supabase) {
        lastContextResolutionError = 'Supabase client is not available.';
        lastContextResolutionDetails = { accountId, hasSupabaseClient: false };
        return null;
    }

    const { data: owner, error: ownerError } = await supabase
        .from('business_owner')
        .select('business_owner_id')
        .eq('account_id', accountId)
        .maybeSingle<OwnerContextRow>();

    if (owner) {
        lastContextResolutionError = null;
        lastContextResolutionDetails = {
            accountId,
            profileTable: 'business_owner',
            businessOwnerId: owner.business_owner_id,
        };
        return owner.business_owner_id;
    }

    const { data: vendor, error: vendorError } = await supabase
        .from('vendor')
        .select('vendor_id, business_owner_id')
        .eq('account_id', accountId)
        .maybeSingle<VendorContextRow>();

    if (vendor) {
        lastContextResolutionError = null;
        lastContextResolutionDetails = {
            accountId,
            profileTable: 'vendor',
            vendorId: vendor.vendor_id,
            businessOwnerId: vendor.business_owner_id,
        };
        return vendor.business_owner_id;
    }

    lastContextResolutionError = 'No business_owner or vendor profile row found for this account_id.';
    lastContextResolutionDetails = {
        accountId,
        businessOwnerError: ownerError?.message,
        vendorError: vendorError?.message,
    };
    logSyncError('unable to resolve owner/vendor profile for transaction sync', {
        ...lastContextResolutionDetails,
    });
    return null;
};

const resolveTransactionContext = async (accountId?: number): Promise<TransactionContext | null> => {
    if (!accountId || !supabase) {
        lastContextResolutionError = !accountId
            ? 'Transaction has no account_id.'
            : 'Supabase client is not available.';
        lastContextResolutionDetails = {
            accountId,
            hasSupabaseClient: Boolean(supabase),
        };
        logSyncError('cannot resolve transaction context without account or supabase client', {
            ...lastContextResolutionDetails,
        });
        return null;
    }

    const businessOwnerId = await resolveBusinessOwnerId(accountId);

    if (!businessOwnerId) {
        return null;
    }

    const { data: business, error: businessError } = await supabase
        .from('business')
        .select('business_id, stall_id, stall_number, stall_no')
        .eq('business_owner_id', businessOwnerId)
        .order('business_id', { ascending: true })
        .limit(1)
        .maybeSingle<BusinessContextRow>();

    if (businessError || !business) {
        lastContextResolutionError = 'No business row found for the resolved business_owner_id.';
        lastContextResolutionDetails = {
            accountId,
            businessOwnerId,
            error: businessError?.message,
        };
        logSyncError('unable to resolve business for transaction sync', {
            ...lastContextResolutionDetails,
        });
        return null;
    }

    const stallNumber = business.stall_number ?? business.stall_no ?? null;
    let stallId = business.stall_id ?? null;

    if (!stallId && stallNumber) {
        const { data: stall, error: stallError } = await supabase
            .from('stalls')
            .select('stall_id, stall_number')
            .eq('stall_number', stallNumber)
            .maybeSingle<StallContextRow>();

        if (stallError) {
            logSyncError('unable to resolve stall by stall_number for transaction sync', {
                accountId,
                stallNumber,
                error: stallError.message,
            });
        }

        stallId = stall?.stall_id ?? stallNumber;
    }

    if (!stallId) {
        lastContextResolutionError = 'Business row has no usable stall_id, stall_number, or stall_no.';
        lastContextResolutionDetails = {
            accountId,
            businessId: business.business_id,
            businessOwnerId,
            businessStallId: business.stall_id,
            businessStallNumber: business.stall_number,
            businessStallNo: business.stall_no,
        };
        logSyncError('business has no stall context for transaction sync', {
            ...lastContextResolutionDetails,
        });
    }

    lastContextResolutionError = stallId ? null : lastContextResolutionError;
    lastContextResolutionDetails = {
        accountId,
        businessOwnerId,
        businessId: business.business_id,
        stallId,
        stallNumber,
        businessStallId: business.stall_id,
        businessStallNumber: business.stall_number,
        businessStallNo: business.stall_no,
    };

    return {
        businessId: business.business_id,
        stallId,
        stallNumber,
    };
};

const enrichTransactionContext = async (transaction: TransactionRecord): Promise<TransactionRecord> => {
    if (transaction.stallId ?? transaction.stallNumber) {
        return transaction;
    }

    const context = await resolveTransactionContext(transaction.accountId);

    if (!context) {
        logSyncError('transaction context could not be resolved before sync', {
            transactionId: transaction.id,
            accountId: transaction.accountId,
            reason: lastContextResolutionError,
            details: lastContextResolutionDetails,
        });
        return transaction;
    }

    logSyncDebug('resolved missing transaction context', {
        transactionId: transaction.id,
        accountId: transaction.accountId,
        context,
    });

    return {
        ...transaction,
        businessId: transaction.businessId ?? context.businessId,
        stallId: transaction.stallId ?? context.stallId,
        stallNumber: transaction.stallNumber ?? context.stallNumber,
    };
};

export const syncTransactionRecordWithResult = async (
    transaction: TransactionRecord,
): Promise<TransactionSyncResult> => {
    if (!isSupabaseConfigured || !supabase) {
        return {
            success: false,
            error: 'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.',
        };
    }

    try {
        const transactionForSync = await enrichTransactionContext(transaction);
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
                contextResolutionError: lastContextResolutionError,
                contextResolutionDetails: lastContextResolutionDetails,
                transaction: transactionForSync,
            });

            return {
                success: false,
                error: errorMessage,
            };
        }

        logSyncDebug('attempting sales_transaction insert', {
            transactionId: transaction.id,
            rowCount: rows.length,
            rows,
        });

        const { error } = await supabase
            .from('sales_transaction')
            .insert(rows);

        if (error) {
            logSyncError('sales_transaction insert failed', {
                transactionId: transaction.id,
                errorMessage: error.message,
                errorDetails: error.details,
                errorHint: error.hint,
                errorCode: error.code,
                rows,
            });

            return {
                success: false,
                error: [
                    error.message,
                    error.details,
                    error.hint,
                    error.code ? `Code: ${error.code}` : undefined,
                ].filter(Boolean).join(' | '),
            };
        }

        logSyncDebug('transaction synced', { transactionId: transaction.id });

        return { success: true };
    } catch (error) {
        logSyncError('sales_transaction sync threw exception', {
            transactionId: transaction.id,
            error,
        });

        return {
            success: false,
            error: getErrorMessage(error),
        };
    }
};

export const syncTransactionRecord = async (
    transaction: TransactionRecord,
): Promise<boolean> => {
    const result = await syncTransactionRecordWithResult(transaction);
    return result.success;
};

interface SalesTransactionScope {
    accountId?: number;
    stallId?: string | null;
    stallNumber?: string | null;
}

export const loadRemoteSalesTransactions = async ({
    accountId,
    stallId,
    stallNumber,
}: SalesTransactionScope): Promise<TransactionRecord[]> => {
    const stallScope = stallId ?? stallNumber;

    if ((!stallScope && !accountId) || !isSupabaseConfigured || !supabase) {
        return [];
    }

    let query = supabase
        .from('sales_transaction')
        .select('transaction_id, stall_id, stall_number, account_id, username, category, product, quantity_sold_kg, unit_price_php, total_revenue_php, transaction_date')
        .order('transaction_date', { ascending: false });

    // Sales belong to a stall. The account filter is only a safe fallback for
    // accounts whose business has not been assigned a stall yet.
    query = stallScope
        ? query.eq('stall_id', stallScope)
        : query.eq('account_id', accountId as number);

    const { data, error } = await query;

    if (error || !data) {
        if (__DEV__ && error) {
            console.error('[TRANSACTIONS_DEBUG] Failed to load remote sales transactions:', error.message);
        }

        return [];
    }

    return (data as SalesTransactionRow[]).map(toTransactionRecord);
};

export const syncUnsyncedTransactions = async (accountId?: number): Promise<{ attempted: number; synced: number }> => {
    if (!isSupabaseConfigured || !supabase) {
        return { attempted: 0, synced: 0 };
    }

    if (!accountId) {
        return { attempted: 0, synced: 0 };
    }

    const unsyncedTransactions = await getUnsyncedTransactions(accountId);
    let synced = 0;

    for (const transaction of unsyncedTransactions) {
        const result = await syncTransactionRecordWithResult(transaction);
        const nextAttempts = (transaction.syncAttempts ?? 0) + 1;

        if (result.success) {
            synced += 1;
            await updateTransactionSyncState(accountId, transaction.id, {
                synced: true,
                syncedAt: Date.now(),
                syncError: undefined,
                syncAttempts: nextAttempts,
            });
        } else {
            logSyncError('batch transaction sync failed', {
                transactionId: transaction.id,
                accountId,
                error: result.error,
                transactionAccountId: transaction.accountId,
                transactionBusinessId: transaction.businessId,
                transactionStallId: transaction.stallId,
                transactionStallNumber: transaction.stallNumber,
                cartItemsCount: transaction.cartItems?.length ?? 0,
            });

            await updateTransactionSyncState(accountId, transaction.id, {
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
