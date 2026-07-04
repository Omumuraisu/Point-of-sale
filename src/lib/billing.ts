import { isSupabaseConfigured, supabase } from './supabase';

interface PaymentRow {
    payment_id: number;
    business_id: number;
    stall_number: string | null;
    payment_type: string;
    amount: number | string;
    due_date: string | null;
    paid_at: string | null;
    status: string | null;
    billing_month: string | null;
    description: string | null;
    violation_type: string | null;
}

export interface BillingSummary {
    status: 'PAID' | 'UNPAID';
    totalAmount: number;
    dueDate: string | null;
    paidAt: string | null;
    billingMonth: string | null;
    paymentCount: number;
    currentMonthAmount: number;
    previousMonthAmount: number;
    rentAmount: number;
    electricityAmount: number;
    waterAmount: number;
    arrearsAmount: number;
}

const PAYMENT_COLUMNS = [
    'payment_id',
    'business_id',
    'stall_number',
    'payment_type',
    'amount',
    'due_date',
    'paid_at',
    'status',
    'billing_month',
    'description',
    'violation_type',
].join(', ');

const toAmount = (value: number | string): number => {
    const amount = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(amount) ? amount : 0;
};

const isPaidPayment = (payment: PaymentRow) => (
    payment.status?.toLowerCase().trim() === 'paid' || Boolean(payment.paid_at)
);

const getPaymentMonth = (payment: PaymentRow) => (
    payment.billing_month ?? payment.due_date ?? ''
);

const getPaymentTypeBucket = (paymentType: string) => {
    const normalized = paymentType.toLowerCase().trim();

    if (normalized.includes('electric')) {
        return 'electricity';
    }

    if (normalized.includes('water')) {
        return 'water';
    }

    if (normalized.includes('rent')) {
        return 'rent';
    }

    return null;
};

const getLatestMonth = (payments: PaymentRow[]) => (
    payments
        .map(getPaymentMonth)
        .filter(Boolean)
        .sort((first, second) => second.localeCompare(first))[0] ?? null
);

const getEarliestDueDate = (payments: PaymentRow[]): string | null => (
    payments
        .map((payment) => payment.due_date)
        .filter((dueDate): dueDate is string => Boolean(dueDate))
        .sort((first, second) => first.localeCompare(second))[0] ?? null
);

const getLatestPaidAt = (payments: PaymentRow[]): string | null => (
    payments
        .map((payment) => payment.paid_at)
        .filter((paidAt): paidAt is string => Boolean(paidAt))
        .sort((first, second) => second.localeCompare(first))[0] ?? null
);

export const fetchBillingSummary = async (
    businessId?: number | null,
    stallNumber?: string | null,
): Promise<BillingSummary | null> => {
    if (!businessId || !isSupabaseConfigured || !supabase) {
        return null;
    }

    let query = supabase
        .from('payments')
        .select(PAYMENT_COLUMNS)
        .eq('business_id', businessId)
        .order('billing_month', { ascending: false, nullsFirst: false })
        .order('due_date', { ascending: true, nullsFirst: false });

    if (stallNumber) {
        query = query.eq('stall_number', stallNumber);
    }

    const { data, error } = await query;

    if (error || !data) {
        if (__DEV__ && error) {
            console.error('[BILLING_DEBUG] Failed to fetch payments:', error.message);
        }

        return null;
    }

    const payments = data as unknown as PaymentRow[];

    if (payments.length === 0) {
        return null;
    }

    const selectedMonth = getLatestMonth(payments);
    const selectedPayments = selectedMonth
        ? payments.filter((payment) => getPaymentMonth(payment) === selectedMonth)
        : payments;
    const arrearsPayments = selectedMonth
        ? payments.filter((payment) => getPaymentMonth(payment) < selectedMonth && !isPaidPayment(payment))
        : [];
    const includedPayments = [...selectedPayments, ...arrearsPayments];
    const amountByBucket = selectedPayments.reduce(
        (totals, payment) => {
            const bucket = getPaymentTypeBucket(payment.payment_type);

            if (bucket) {
                totals[bucket] += toAmount(payment.amount);
            }

            return totals;
        },
        {
            rent: 0,
            electricity: 0,
            water: 0,
        },
    );
    const arrearsAmount = arrearsPayments.reduce((sum, payment) => sum + toAmount(payment.amount), 0);
    const currentMonthAmount = selectedPayments.reduce((sum, payment) => sum + toAmount(payment.amount), 0);

    return {
        status: includedPayments.every(isPaidPayment) ? 'PAID' : 'UNPAID',
        totalAmount: currentMonthAmount + arrearsAmount,
        dueDate: getEarliestDueDate(selectedPayments),
        paidAt: getLatestPaidAt(includedPayments),
        billingMonth: selectedMonth,
        paymentCount: includedPayments.length,
        currentMonthAmount,
        previousMonthAmount: arrearsAmount,
        rentAmount: amountByBucket.rent,
        electricityAmount: amountByBucket.electricity,
        waterAmount: amountByBucket.water,
        arrearsAmount,
    };
};
