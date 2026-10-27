import { getWeeklySales, getWeeklySalesNavigation } from '../src/lib/weeklySalesPatterns';
import { TransactionRecord } from '../src/lib/types';

const transaction = (
    id: string,
    createdAt: string,
    totalDue: number,
    overrides: Partial<TransactionRecord> = {},
): TransactionRecord => ({
    id,
    item: `Sale ${id}`,
    amount: `P${totalDue}`,
    subtitle: '1 item',
    category: 'General',
    categoryType: { key: 'general', label: 'General' },
    dateLabel: createdAt,
    createdAt: new Date(createdAt).getTime(),
    totalDue,
    ...overrides,
});

const NOW = new Date('2026-12-31T17:00:00.000Z'); // Jan 1, 2027, 1:00 AM in Manila

test('returns current and previous Monday-to-Sunday ranges across a year boundary', () => {
    const currentWeek = getWeeklySales([], 0, NOW);
    const previousWeek = getWeeklySales([], -1, NOW);

    expect([currentWeek.weekStartDateKey, currentWeek.weekEndDateKey]).toEqual([
        '2026-12-28',
        '2027-01-03',
    ]);
    expect([previousWeek.weekStartDateKey, previousWeek.weekEndDateKey]).toEqual([
        '2026-12-21',
        '2026-12-27',
    ]);
});

test('only enables navigation toward the other available week', () => {
    expect(getWeeklySalesNavigation(0)).toEqual({
        canViewPrevious: true,
        canViewNext: false,
    });
    expect(getWeeklySalesNavigation(-1)).toEqual({
        canViewPrevious: false,
        canViewNext: true,
    });
});

test('groups transactions by their Asia/Manila calendar date and selected week', () => {
    const transactions = [
        transaction('current-monday', '2026-12-27T16:30:00.000Z', 125),
        transaction('previous-sunday', '2026-12-27T15:30:00.000Z', 250),
        transaction('too-old', '2026-12-20T15:30:00.000Z', 500),
    ];

    const currentWeek = getWeeklySales(transactions, 0, NOW);
    const previousWeek = getWeeklySales(transactions, -1, NOW);

    expect(currentWeek.totalRevenuePhp).toBe(125);
    expect(currentWeek.transactionCount).toBe(1);
    expect(currentWeek.days[0]).toMatchObject({
        dateKey: '2026-12-28',
        revenuePhp: 125,
        transactionCount: 1,
    });
    expect(previousWeek.totalRevenuePhp).toBe(250);
    expect(previousWeek.transactionCount).toBe(1);
    expect(previousWeek.days[6]).toMatchObject({
        dateKey: '2026-12-27',
        revenuePhp: 250,
        transactionCount: 1,
    });
});

test('deduplicates merged records and only marks days in the current week as current or future', () => {
    const duplicateLocal = transaction('local-copy', '2026-12-22T02:00:00.000Z', 300, {
        clientOrderKey: 'shared-order',
    });
    const duplicateRemote = transaction('remote-copy', '2026-12-22T02:00:00.000Z', 300, {
        clientOrderKey: 'shared-order',
    });

    const previousWeek = getWeeklySales([duplicateLocal, duplicateRemote], -1, NOW);
    const currentWeek = getWeeklySales([], 0, NOW);

    expect(previousWeek.totalRevenuePhp).toBe(300);
    expect(previousWeek.transactionCount).toBe(1);
    expect(previousWeek.days.every((day) => !day.isToday && !day.isFuture)).toBe(true);
    expect(currentWeek.days.find((day) => day.dateKey === '2027-01-01')?.isToday).toBe(true);
    expect(currentWeek.days.find((day) => day.dateKey === '2027-01-02')?.isFuture).toBe(true);
});
