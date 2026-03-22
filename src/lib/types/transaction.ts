import { CartItem } from './cart';
import { TransactionCategoryType } from './category';

export interface TransactionRecord {
    id: string;
    item: string;
    amount: string;
    subtitle: string;
    category: string;
    categoryType: TransactionCategoryType;
    dateLabel: string;
    createdAt: number;
    cartItems?: CartItem[];
    paidAmount?: number;
    totalDue?: number;
    synced?: boolean;
    syncedAt?: number;
    syncError?: string;
    syncAttempts?: number;
}

export interface SaveReceiptTransactionInput {
    cartItems: CartItem[];
    paidAmount: number;
    totalDue: number;
}
