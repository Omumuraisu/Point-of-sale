import { TransactionRecord } from './types';

export const getTransactionTotal = (transaction: TransactionRecord): number => {
    if (Number.isFinite(transaction.totalDue)) {
        return Number(transaction.totalDue);
    }

    return transaction.cartItems?.reduce(
        (sum, item) => sum + (Number.isFinite(item.total) ? item.total : 0),
        0,
    ) ?? 0;
};

const startOfDay = (date: Date): number => (
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
);

export const getSalesTotalForRange = (
    transactions: TransactionRecord[],
    rangeStart: number,
    rangeEnd: number,
): number => transactions.reduce((sum, transaction) => (
    transaction.createdAt >= rangeStart && transaction.createdAt < rangeEnd
        ? sum + getTransactionTotal(transaction)
        : sum
), 0);

export const getTodaySalesSummary = (
    transactions: TransactionRecord[],
    now = new Date(),
): { total: number; growthPercent: number | null } => {
    const todayStart = startOfDay(now);
    const tomorrowStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
    ).getTime();
    const yesterdayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
    ).getTime();
    const total = getSalesTotalForRange(transactions, todayStart, tomorrowStart);
    const yesterdayTotal = getSalesTotalForRange(transactions, yesterdayStart, todayStart);

    return {
        total,
        growthPercent: yesterdayTotal > 0
            ? ((total - yesterdayTotal) / yesterdayTotal) * 100
            : null,
    };
};
