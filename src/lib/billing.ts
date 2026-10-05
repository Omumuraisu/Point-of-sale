import { isSupabaseConfigured, supabase } from './supabase';
import { debugError } from './debugLogging';
import { applyBillingScope } from './queryScopes';

export type BillingStatus = 'pending' | 'partially_paid' | 'overdue' | 'overdue_partially_paid' | 'fully_paid';

export interface BillingScope {
    businessOwnerId: number | null | undefined;
    businessId: number | null | undefined;
    stallNumber: string | null | undefined;
}

export interface BillingFocus {
    billingCycleId?: number | null;
    billingMonth?: string | null;
}

export interface BillingCharge {
    id: number;
    code: string;
    label: string;
    amount: number;
    description: string | null;
}

export interface BillPaymentAllocation {
    transactionId: number;
    allocationId: number;
    amount: number;
    paymentDate: string | null;
    referenceNumber: string | null;
    notes: string | null;
    recordedByStaffId: number | null;
    recordedBy: string | null;
    recordedAt: string | null;
}

export interface MonthlyBillBalance {
    monthlyBillId: number;
    billingCycleId: number | null;
    businessOwnerId: number;
    businessId: number;
    stallNumber: string;
    billingMonth: string;
    dueDate: string;
    ownerName: string;
    businessName: string;
    issuedAt: string;
    totalAmount: number;
    rentAmount: number;
    electricityAmount: number;
    waterAmount: number;
    otherAmount: number;
    appliedAmount: number;
    balance: number;
    status: BillingStatus;
    isArrears: boolean;
    chargeBreakdown: BillingCharge[];
    paymentHistory: BillPaymentAllocation[];
}

export interface BillingSummary {
    currentBill: MonthlyBillBalance;
    arrearsBills: MonthlyBillBalance[];
    arrearsAmount: number;
    totalOutstanding: number;
    focusedBillId: number | null;
}

export interface PaymentHistoryEntry {
    paymentId: number;
    amount: number;
    paidAt: string | null;
    referenceNumber: string | null;
    notes: string | null;
}

interface MonthlyBillBalanceRow {
    monthly_bill_id: number | string | null;
    billing_cycle_id: number | string | null;
    business_owner_id: number | string | null;
    business_id: number | string | null;
    stall_number: string | null;
    billing_month: string | null;
    due_date: string | null;
    owner_name: string | null;
    business_name: string | null;
    issued_at: string | null;
    total_amount: number | string | null;
    rent_amount: number | string | null;
    electricity_amount: number | string | null;
    water_amount: number | string | null;
    other_amount: number | string | null;
    applied_amount: number | string | null;
    balance: number | string | null;
    status: string | null;
    is_arrears: boolean | null;
    charge_breakdown: unknown;
    payment_history: unknown;
}

const BILLING_COLUMNS = [
    'monthly_bill_id', 'billing_cycle_id', 'business_owner_id', 'business_id', 'stall_number',
    'billing_month', 'due_date', 'owner_name', 'business_name', 'issued_at', 'total_amount',
    'rent_amount', 'electricity_amount', 'water_amount', 'other_amount', 'applied_amount',
    'balance', 'status', 'is_arrears', 'charge_breakdown', 'payment_history',
].join(', ');

const BILLING_STATUSES = new Set<BillingStatus>([
    'pending', 'partially_paid', 'overdue', 'overdue_partially_paid', 'fully_paid',
]);

const toAmount = (value: unknown): number => {
    const amount = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(amount) ? amount : 0;
};

const toInteger = (value: unknown): number => {
    const integer = typeof value === 'number' ? value : Number(value);
    return Number.isSafeInteger(integer) ? integer : 0;
};

const toNullableInteger = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const integer = toInteger(value);
    return integer > 0 ? integer : null;
};

const asRecordArray = (value: unknown): Record<string, unknown>[] => {
    let parsed = value;
    if (typeof value === 'string') {
        try { parsed = JSON.parse(value); } catch { return []; }
    }
    return Array.isArray(parsed)
        ? parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        : [];
};

const mapCharges = (value: unknown): BillingCharge[] => asRecordArray(value).map((charge) => ({
    id: toInteger(charge.id),
    code: typeof charge.code === 'string' ? charge.code : 'other',
    label: typeof charge.label === 'string' && charge.label.trim() ? charge.label : 'Other charge',
    amount: toAmount(charge.amount),
    description: typeof charge.description === 'string' ? charge.description : null,
}));

const mapPaymentHistory = (value: unknown): BillPaymentAllocation[] => asRecordArray(value)
    .map((payment) => ({
        transactionId: toInteger(payment.transactionId),
        allocationId: toInteger(payment.allocationId),
        amount: toAmount(payment.amount),
        paymentDate: typeof payment.paymentDate === 'string' ? payment.paymentDate : null,
        referenceNumber: typeof payment.referenceNumber === 'string' ? payment.referenceNumber : null,
        notes: typeof payment.notes === 'string' ? payment.notes : null,
        recordedByStaffId: toNullableInteger(payment.recordedByStaffId),
        recordedBy: typeof payment.recordedBy === 'string' && payment.recordedBy.trim() ? payment.recordedBy : null,
        recordedAt: typeof payment.recordedAt === 'string' ? payment.recordedAt : null,
    }))
    .filter((payment) => payment.transactionId > 0 && payment.allocationId > 0);

export const mapMonthlyBillRow = (row: MonthlyBillBalanceRow): MonthlyBillBalance => {
    const normalizedStatus = row.status?.toLowerCase().trim() as BillingStatus;
    return {
        monthlyBillId: toInteger(row.monthly_bill_id),
        billingCycleId: toNullableInteger(row.billing_cycle_id),
        businessOwnerId: toInteger(row.business_owner_id),
        businessId: toInteger(row.business_id),
        stallNumber: row.stall_number ?? '',
        billingMonth: row.billing_month ?? '',
        dueDate: row.due_date ?? '',
        ownerName: row.owner_name ?? '',
        businessName: row.business_name ?? '',
        issuedAt: row.issued_at ?? '',
        totalAmount: toAmount(row.total_amount),
        rentAmount: toAmount(row.rent_amount),
        electricityAmount: toAmount(row.electricity_amount),
        waterAmount: toAmount(row.water_amount),
        otherAmount: toAmount(row.other_amount),
        appliedAmount: toAmount(row.applied_amount),
        balance: toAmount(row.balance),
        status: BILLING_STATUSES.has(normalizedStatus) ? normalizedStatus : 'pending',
        isArrears: row.is_arrears === true,
        chargeBreakdown: mapCharges(row.charge_breakdown),
        paymentHistory: mapPaymentHistory(row.payment_history),
    };
};

export const buildBillingSummary = (bills: MonthlyBillBalance[], focus: BillingFocus = {}): BillingSummary | null => {
    if (bills.length === 0) return null;
    const sorted = [...bills].sort((first, second) => (
        second.billingMonth.localeCompare(first.billingMonth) || second.monthlyBillId - first.monthlyBillId
    ));
    const currentBill = sorted[0];
    const arrearsBills = sorted.filter((bill) => bill.isArrears && bill.balance > 0);
    const arrearsAmount = arrearsBills.reduce((sum, bill) => sum + bill.balance, 0);
    const focusedBill = (focus.billingCycleId
        ? sorted.find((bill) => bill.billingCycleId === focus.billingCycleId)
        : undefined) ?? (focus.billingMonth
        ? sorted.find((bill) => bill.billingMonth === focus.billingMonth)
        : undefined);
    return {
        currentBill,
        arrearsBills,
        arrearsAmount,
        totalOutstanding: currentBill.balance + arrearsAmount,
        focusedBillId: focusedBill?.monthlyBillId ?? null,
    };
};

const hasCompleteScope = (scope: BillingScope): scope is BillingScope & {
    businessOwnerId: number;
    businessId: number;
    stallNumber: string;
} => (
    Boolean(scope.businessOwnerId && scope.businessId && scope.stallNumber)
);

const fetchScopedBills = async (scope: BillingScope): Promise<MonthlyBillBalance[]> => {
    if (!hasCompleteScope(scope)) return [];
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase is not configured.');
    const scopedQuery = applyBillingScope(supabase
        .from('v_monthly_bill_balances')
        .select(BILLING_COLUMNS), scope);
    const { data, error } = await scopedQuery
        .order('billing_month', { ascending: false })
        .order('monthly_bill_id', { ascending: false });
    if (error) {
        debugError('billing-lease', 'failed to fetch monthly bill balances', { message: error.message });
        throw error;
    }
    return ((data ?? []) as unknown as MonthlyBillBalanceRow[]).map(mapMonthlyBillRow);
};

export const fetchBillingSummary = async (scope: BillingScope, focus: BillingFocus = {}): Promise<BillingSummary | null> => (
    buildBillingSummary(await fetchScopedBills(scope), focus)
);

export const buildPaymentHistory = (bills: MonthlyBillBalance[]): PaymentHistoryEntry[] => {
    const transactions = new Map<number, PaymentHistoryEntry>();
    bills.forEach((bill) => bill.paymentHistory.forEach((allocation) => {
        const existing = transactions.get(allocation.transactionId);
        transactions.set(allocation.transactionId, {
            paymentId: allocation.transactionId,
            amount: (existing?.amount ?? 0) + allocation.amount,
            paidAt: existing?.paidAt ?? allocation.paymentDate,
            referenceNumber: existing?.referenceNumber ?? allocation.referenceNumber,
            notes: existing?.notes ?? allocation.notes,
        });
    }));
    return Array.from(transactions.values()).sort((first, second) => (
        (second.paidAt ?? '').localeCompare(first.paidAt ?? '') || second.paymentId - first.paymentId
    ));
};

export const fetchPaymentHistory = async (scope: BillingScope): Promise<PaymentHistoryEntry[]> => (
    buildPaymentHistory(await fetchScopedBills(scope))
);
