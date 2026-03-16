import AsyncStorage from '@react-native-async-storage/async-storage';

const SALES_TRANSACTIONS_KEY = '@pos/sales-transactions';
const MAX_SAVED_TRANSACTIONS = 100;

const MONTH_LABELS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];

const formatCurrency = (value) => `P ${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;

const formatTransactionDate = (timestamp) => {
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

const getCategoryType = (category) => {
    const normalized = String(category || '').toLowerCase();

    if (normalized.includes('meat')) {
        return 'meat';
    }

    if (normalized.includes('dry')) {
        return 'dry';
    }

    return 'neutral';
};

const toTransaction = ({ cartItems = [], paidAmount = 0, totalDue = 0, createdAt = Date.now() }) => {
    const itemCount = cartItems.length;
    const firstItem = cartItems[0] ?? {};

    const categorySet = new Set(
        cartItems
            .map((item) => String(item?.category || '').trim())
            .filter(Boolean),
    );

    const category = categorySet.size === 1
        ? Array.from(categorySet)[0]
        : (categorySet.size > 1 ? 'Mixed' : 'General');

    const itemTitle = itemCount > 1
        ? `${String(firstItem?.name || 'Sale')} +${itemCount - 1} more`
        : String(firstItem?.name || 'Sale');

    const settledAmount = Number.isFinite(totalDue) && totalDue > 0
        ? totalDue
        : cartItems.reduce((sum, item) => sum + (Number.isFinite(item?.total) ? item.total : 0), 0);

    const transactionId = `#${String(createdAt).slice(-6)}`;

    return {
        id: transactionId,
        item: itemTitle,
        amount: formatCurrency(settledAmount),
        subtitle: `${itemCount} item${itemCount === 1 ? '' : 's'} • Paid ${formatCurrency(Number(paidAmount) || settledAmount)}`,
        category,
        categoryType: getCategoryType(category),
        dateLabel: formatTransactionDate(createdAt),
        createdAt,
    };
};

export const loadSavedTransactions = async () => {
    try {
        const raw = await AsyncStorage.getItem(SALES_TRANSACTIONS_KEY);

        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed;
    } catch {
        return [];
    }
};

export const saveReceiptTransaction = async ({ cartItems = [], paidAmount = 0, totalDue = 0 }) => {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
        return null;
    }

    const createdAt = Date.now();
    const transaction = toTransaction({
        cartItems,
        paidAmount: Number(paidAmount) || 0,
        totalDue: Number(totalDue) || 0,
        createdAt,
    });

    const existing = await loadSavedTransactions();
    const updated = [transaction, ...existing].slice(0, MAX_SAVED_TRANSACTIONS);

    try {
        await AsyncStorage.setItem(SALES_TRANSACTIONS_KEY, JSON.stringify(updated));
    } catch {
        return null;
    }

    return transaction;
};
