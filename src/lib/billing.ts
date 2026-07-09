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

export interface BillingMonthSummary {
    billingMonth: string | null;
    status: 'PAID' | 'UNPAID';
    totalAmount: number;
    unpaidAmount: number;
    dueDate: string | null;
    paidAt: string | null;
    paymentCount: number;
    rentAmount: number;
    electricityAmount: number;
    waterAmount: number;
    violationsAmount: number;
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
    violationsAmount: number;
    arrearsAmount: number;
    currentBill: BillingMonthSummary | null;
    arrearsMonths: BillingMonthSummary[];
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

const getPaymentTypeBucket = (payment: PaymentRow) => {
    const normalized = [
        payment.payment_type,
        payment.violation_type,
        payment.description,
    ].filter(Boolean).join(' ').toLowerCase().trim();

    if (normalized.includes('electric')) {
        return 'electricity';
    }

    if (normalized.includes('water')) {
        return 'water';
    }

    if (normalized.includes('rent')) {
        return 'rent';
    }

    if (normalized.includes('violation') || normalized.includes('penalty') || normalized.includes('fine')) {
        return 'violations';
    }

    return null;
};

const getLatestMonth = (months: string[]) => (
    months
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

const summarizeMonth = (billingMonth: string | null, payments: PaymentRow[]): BillingMonthSummary => {
    const amountByBucket = payments.reduce(
        (totals, payment) => {
            const bucket = getPaymentTypeBucket(payment);
            const amount = toAmount(payment.amount);

            if (bucket) {
                totals[bucket] += amount;
            }

            return totals;
        },
        {
            rent: 0,
            electricity: 0,
            water: 0,
            violations: 0,
        },
    );
    const unpaidPayments = payments.filter((payment) => !isPaidPayment(payment));
    const totalAmount = amountByBucket.rent
        + amountByBucket.electricity
        + amountByBucket.water
        + amountByBucket.violations;

    return {
        billingMonth,
        status: unpaidPayments.length > 0 ? 'UNPAID' : 'PAID',
        totalAmount,
        unpaidAmount: unpaidPayments.reduce((sum, payment) => sum + toAmount(payment.amount), 0),
        dueDate: getEarliestDueDate(payments),
        paidAt: getLatestPaidAt(payments),
        paymentCount: payments.length,
        rentAmount: amountByBucket.rent,
        electricityAmount: amountByBucket.electricity,
        waterAmount: amountByBucket.water,
        violationsAmount: amountByBucket.violations,
    };
};

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

    const paymentsByMonth = payments.reduce((groups, payment) => {
        const month = getPaymentMonth(payment);
        const key = month || 'unassigned';
        const monthPayments = groups.get(key) ?? [];

        monthPayments.push(payment);
        groups.set(key, monthPayments);

        return groups;
    }, new Map<string, PaymentRow[]>());
    const monthSummaries = Array.from(paymentsByMonth.entries())
        .map(([month, monthPayments]) => summarizeMonth(month === 'unassigned' ? null : month, monthPayments))
        .sort((first, second) => (second.billingMonth ?? '').localeCompare(first.billingMonth ?? ''));
    const selectedMonth = getLatestMonth(monthSummaries.map((summary) => summary.billingMonth ?? ''));
    const currentBill = monthSummaries.find((summary) => summary.billingMonth === selectedMonth)
        ?? monthSummaries[0]
        ?? null;
    const arrearsMonths = monthSummaries.filter((summary) => (
        summary.billingMonth !== currentBill?.billingMonth
        && summary.unpaidAmount > 0
    ));
    const arrearsAmount = arrearsMonths.reduce((sum, month) => sum + month.unpaidAmount, 0);
    const currentMonthAmount = currentBill?.unpaidAmount ?? 0;
    const totalDue = currentMonthAmount + arrearsAmount;
    const currentMonthPaidAmount = currentBill?.totalAmount ?? 0;

    return {
        status: totalDue > 0 ? 'UNPAID' : 'PAID',
        totalAmount: totalDue > 0 ? totalDue : currentMonthPaidAmount,
        dueDate: currentBill?.dueDate ?? null,
        paidAt: getLatestPaidAt(payments),
        billingMonth: currentBill?.billingMonth ?? null,
        paymentCount: monthSummaries.reduce((sum, month) => sum + month.paymentCount, 0),
        currentMonthAmount,
        previousMonthAmount: arrearsAmount,
        rentAmount: currentBill?.rentAmount ?? 0,
        electricityAmount: currentBill?.electricityAmount ?? 0,
        waterAmount: currentBill?.waterAmount ?? 0,
        violationsAmount: currentBill?.violationsAmount ?? 0,
        arrearsAmount,
        currentBill,
        arrearsMonths,
    };
};
