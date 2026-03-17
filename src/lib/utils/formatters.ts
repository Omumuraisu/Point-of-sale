const MONTH_LABELS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];

export const formatCurrency = (value: number): string => `P ${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;

export const formatTransactionDate = (timestamp: number): string => {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const month = MONTH_LABELS[date.getMonth()] ?? 'Jan.';
    const day = date.getDate();
    const year = date.getFullYear();

    const hours24 = date.getHours();
    const suffix = hours24 >= 12 ? 'PM' : 'AM';
    const hour12 = hours24 % 12 || 12;
    const minute = String(date.getMinutes()).padStart(2, '0');

    return `${month} ${day}, ${year} | ${hour12}:${minute}${suffix}`;
};
