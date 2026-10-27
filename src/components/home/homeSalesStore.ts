import AsyncStorage from '@react-native-async-storage/async-storage';

import { TransactionRecord, TransactionScope } from '../../lib/types';
import { isTransactionRecord } from '../../lib/utils';
import { debugError, debugWarn } from '../../lib/debugLogging';

const HOME_SALES_CACHE_VERSION = 1;

export interface HomeSalesCacheRecord {
    version: typeof HOME_SALES_CACHE_VERSION;
    accountId: number;
    businessId: number;
    stallNumber: string;
    updatedAt: number;
    transactions: TransactionRecord[];
}

const cacheKey = ({ accountId, businessId, stallNumber }: TransactionScope) => (
    `@pos/home-sales:v1:${accountId}:${businessId}:${stallNumber}`
);

const isValidScope = (scope: TransactionScope): boolean => (
    Number.isInteger(scope.accountId) && scope.accountId > 0
    && Number.isInteger(scope.businessId) && scope.businessId > 0
    && scope.stallNumber.trim().length > 0
);

const startOfYesterday = (now: Date): number => new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
).getTime();

export const pruneHomeSalesTransactions = (
    transactions: TransactionRecord[],
    now = new Date(),
): TransactionRecord[] => {
    const sorted = [...transactions].sort((first, second) => second.createdAt - first.createdAt);
    const recentIds = new Set(sorted.slice(0, 3).map((transaction) => transaction.id));
    const yesterdayStart = startOfYesterday(now);

    return sorted.filter((transaction) => transaction.createdAt >= yesterdayStart || recentIds.has(transaction.id));
};

const isHomeSalesCacheRecord = (
    value: unknown,
    scope: TransactionScope,
): value is HomeSalesCacheRecord => {
    if (!value || typeof value !== 'object') return false;
    const record = value as Partial<HomeSalesCacheRecord>;
    return record.version === HOME_SALES_CACHE_VERSION
        && record.accountId === scope.accountId
        && record.businessId === scope.businessId
        && record.stallNumber === scope.stallNumber
        && typeof record.updatedAt === 'number'
        && Array.isArray(record.transactions)
        && record.transactions.every(isTransactionRecord);
};

export const loadHomeSalesCache = async (scope: TransactionScope): Promise<TransactionRecord[]> => {
    if (!isValidScope(scope)) return [];
    try {
        const raw = await AsyncStorage.getItem(cacheKey(scope));
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return isHomeSalesCacheRecord(parsed, scope)
            ? pruneHomeSalesTransactions(parsed.transactions)
            : [];
    } catch (error) {
        debugError('transactions-payments', 'failed to load homepage sales cache', { error });
        return [];
    }
};

export const saveHomeSalesCache = async (
    scope: TransactionScope,
    transactions: TransactionRecord[],
): Promise<boolean> => {
    if (!isValidScope(scope)) return false;
    const record: HomeSalesCacheRecord = {
        version: HOME_SALES_CACHE_VERSION,
        ...scope,
        updatedAt: Date.now(),
        transactions: pruneHomeSalesTransactions(transactions),
    };
    try {
        await AsyncStorage.setItem(cacheKey(scope), JSON.stringify(record));
        return true;
    } catch (error) {
        debugWarn('transactions-payments', 'failed to save homepage sales cache', { error });
        return false;
    }
};
