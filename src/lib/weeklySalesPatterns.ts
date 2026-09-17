import { getTransactionTotal } from './salesMetrics';
import { TransactionRecord } from './types';

export interface WeeklySalesDay {
    dateKey: string;
    dayOfWeek: string;
    dowIndex: number;
    revenuePhp: number;
    transactionCount: number;
    isWeekend: boolean;
    isToday: boolean;
    isFuture: boolean;
}

export interface CurrentWeekSales {
    days: WeeklySalesDay[];
    weekStartDateKey: string;
    weekEndDateKey: string;
    totalRevenuePhp: number;
    transactionCount: number;
}

const DAY_LABELS = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
];

const MANILA_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

const getManilaDateKey = (date: Date): string => {
    const parts = MANILA_DATE_FORMATTER.formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return year && month && day ? `${year}-${month}-${day}` : '';
};

const dateKeyToUtcTimestamp = (dateKey: string): number => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
};

const shiftDateKey = (dateKey: string, dayOffset: number): string => {
    const shiftedDate = new Date(dateKeyToUtcTimestamp(dateKey) + dayOffset * 24 * 60 * 60 * 1000);
    return shiftedDate.toISOString().slice(0, 10);
};

const getTransactionIdentity = (transaction: TransactionRecord): string => {
    if (transaction.clientOrderKey) {
        return `client:${transaction.clientOrderKey}`;
    }

    if (transaction.orderId !== undefined) {
        return `order:${transaction.orderId}`;
    }

    return `transaction:${transaction.id}`;
};

export const getCurrentWeekSales = (
    transactions: TransactionRecord[],
    now = new Date(),
): CurrentWeekSales => {
    const todayDateKey = getManilaDateKey(now);

    if (!todayDateKey) {
        return {
            days: [],
            weekStartDateKey: '',
            weekEndDateKey: '',
            totalRevenuePhp: 0,
            transactionCount: 0,
        };
    }

    const todayUtcDay = new Date(dateKeyToUtcTimestamp(todayDateKey)).getUTCDay();
    const todayDowIndex = (todayUtcDay + 6) % 7;
    const weekStartDateKey = shiftDateKey(todayDateKey, -todayDowIndex);
    const weekEndDateKey = shiftDateKey(weekStartDateKey, 6);
    const seenTransactions = new Set<string>();
    const totalsByDate = new Map<string, { revenuePhp: number; transactionCount: number }>();

    transactions.forEach((transaction) => {
        const transactionDate = new Date(transaction.createdAt);

        if (Number.isNaN(transactionDate.getTime())) {
            return;
        }

        const transactionDateKey = getManilaDateKey(transactionDate);

        if (
            transactionDateKey < weekStartDateKey
            || transactionDateKey > weekEndDateKey
            || transactionDateKey > todayDateKey
        ) {
            return;
        }

        const identity = getTransactionIdentity(transaction);

        if (seenTransactions.has(identity)) {
            return;
        }

        seenTransactions.add(identity);

        const existing = totalsByDate.get(transactionDateKey) ?? {
            revenuePhp: 0,
            transactionCount: 0,
        };

        existing.revenuePhp += getTransactionTotal(transaction);
        existing.transactionCount += 1;
        totalsByDate.set(transactionDateKey, existing);
    });

    const days = DAY_LABELS.map((dayOfWeek, dowIndex): WeeklySalesDay => {
        const dateKey = shiftDateKey(weekStartDateKey, dowIndex);
        const totals = totalsByDate.get(dateKey);

        return {
            dateKey,
            dayOfWeek,
            dowIndex,
            revenuePhp: totals?.revenuePhp ?? 0,
            transactionCount: totals?.transactionCount ?? 0,
            isWeekend: dowIndex >= 5,
            isToday: dateKey === todayDateKey,
            isFuture: dateKey > todayDateKey,
        };
    });

    return {
        days,
        weekStartDateKey,
        weekEndDateKey,
        totalRevenuePhp: days.reduce((sum, day) => sum + day.revenuePhp, 0),
        transactionCount: days.reduce((sum, day) => sum + day.transactionCount, 0),
    };
};
