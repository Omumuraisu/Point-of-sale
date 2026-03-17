import AsyncStorage from '@react-native-async-storage/async-storage';
import { SaveReceiptTransactionInput, TransactionRecord } from '../../lib/types';
import { isTransactionRecord, toTransaction } from '../../lib/utils';

const SALES_TRANSACTIONS_KEY = '@pos/sales-transactions';
const MAX_SAVED_TRANSACTIONS = 100;

export const loadSavedTransactions = async (): Promise<TransactionRecord[]> => {
    try {
        const raw = await AsyncStorage.getItem(SALES_TRANSACTIONS_KEY);

        if (!raw) {
            return [];
        }

        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        // Keep only records that satisfy the strict typed shape.
        return parsed.filter(isTransactionRecord);
    } catch {
        return [];
    }
};

export const saveReceiptTransaction = async ({ cartItems, paidAmount, totalDue }: SaveReceiptTransactionInput): Promise<TransactionRecord | null> => {
    if (cartItems.length === 0) {
        return null;
    }

    const createdAt = Date.now();
    const transaction = toTransaction({
        cartItems,
        paidAmount,
        totalDue,
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
