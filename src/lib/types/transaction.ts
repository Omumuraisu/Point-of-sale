import { CartItem } from './cart';
import { TransactionCategoryType } from './category';

export interface TransactionRecord {
    id: string;
    orderId?: number;
    clientOrderKey?: string;
    accountId?: number;
    username?: string;
    businessId?: number | null;
    stallId?: string | null;
    stallNumber?: string | null;
    item: string;
    amount: string;
    subtitle: string;
    category: string;
    categoryType: TransactionCategoryType;
    dateLabel: string;
    createdAt: number;
    preparedAt?: number;
    completedAt?: number;
    cartItems?: CartItem[];
    paidAmount?: number;
    totalDue?: number;
    changeAmount?: number;
    synced?: boolean;
    syncedAt?: number;
    syncError?: string;
    syncAttempts?: number;
}

export interface SaveReceiptTransactionInput {
    cartItems: CartItem[];
    paidAmount: number;
    totalDue: number;
    accountId: number;
    username: string;
    clientOrderKey: string;
    preparedAt: number;
    businessId?: number | null;
    stallId?: string | null;
    stallNumber?: string | null;
}
