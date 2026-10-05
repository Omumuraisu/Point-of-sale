jest.mock('../src/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: null }));
jest.mock('../src/lib/debugLogging', () => ({ debugError: jest.fn() }));

import {
    buildBillingSummary,
    buildPaymentHistory,
    mapMonthlyBillRow,
    MonthlyBillBalance,
} from '../src/lib/billing';

const row = (overrides: Record<string, unknown> = {}) => ({
    monthly_bill_id: 1,
    billing_cycle_id: 10,
    business_owner_id: 20,
    business_id: 30,
    stall_number: 'A-1',
    billing_month: '2026-10-01',
    due_date: '2026-10-15',
    owner_name: 'Owner',
    business_name: 'Shop',
    issued_at: '2026-10-01T08:00:00',
    total_amount: '1500.00',
    rent_amount: '1000',
    electricity_amount: '300',
    water_amount: '200',
    other_amount: '0',
    applied_amount: '500',
    balance: '1000',
    status: 'partially_paid',
    is_arrears: false,
    charge_breakdown: [{ id: 1, code: 'rent', label: 'Rent', amount: '1000', description: null }],
    payment_history: [],
    ...overrides,
});

const bill = (overrides: Partial<MonthlyBillBalance> = {}) => mapMonthlyBillRow(row(overridesToRow(overrides)) as never);

const overridesToRow = (overrides: Partial<MonthlyBillBalance>) => ({
    ...(overrides.monthlyBillId !== undefined ? { monthly_bill_id: overrides.monthlyBillId } : {}),
    ...(overrides.billingCycleId !== undefined ? { billing_cycle_id: overrides.billingCycleId } : {}),
    ...(overrides.billingMonth !== undefined ? { billing_month: overrides.billingMonth } : {}),
    ...(overrides.totalAmount !== undefined ? { total_amount: overrides.totalAmount } : {}),
    ...(overrides.appliedAmount !== undefined ? { applied_amount: overrides.appliedAmount } : {}),
    ...(overrides.balance !== undefined ? { balance: overrides.balance } : {}),
    ...(overrides.status !== undefined ? { status: overrides.status } : {}),
    ...(overrides.isArrears !== undefined ? { is_arrears: overrides.isArrears } : {}),
    ...(overrides.paymentHistory !== undefined ? { payment_history: overrides.paymentHistory } : {}),
});

describe('monthly billing view mapping', () => {
    test.each(['pending', 'partially_paid', 'overdue', 'overdue_partially_paid', 'fully_paid'] as const)(
        'supports %s',
        (status) => expect(mapMonthlyBillRow(row({ status }) as never).status).toBe(status),
    );

    test('uses authoritative applied and remaining amounts with itemized charges', () => {
        const mapped = mapMonthlyBillRow(row() as never);
        expect(mapped.totalAmount).toBe(1500);
        expect(mapped.appliedAmount).toBe(500);
        expect(mapped.balance).toBe(1000);
        expect(mapped.chargeBreakdown).toEqual([
            expect.objectContaining({ code: 'rent', label: 'Rent', amount: 1000 }),
        ]);
    });

    test('safely ignores malformed JSON arrays', () => {
        const mapped = mapMonthlyBillRow(row({ charge_breakdown: '{bad', payment_history: {} }) as never);
        expect(mapped.chargeBreakdown).toEqual([]);
        expect(mapped.paymentHistory).toEqual([]);
    });
});

describe('billing summary', () => {
    test('selects the newest bill and uses only the view arrears indicator', () => {
        const summary = buildBillingSummary([
            bill({ monthlyBillId: 3, billingMonth: '2026-10-01', balance: 600, appliedAmount: 400 }),
            bill({ monthlyBillId: 2, billingMonth: '2026-09-01', balance: 200, isArrears: true }),
            bill({ monthlyBillId: 1, billingMonth: '2026-08-01', balance: 900, isArrears: false }),
        ]);
        expect(summary?.currentBill.monthlyBillId).toBe(3);
        expect(summary?.arrearsBills.map((item) => item.monthlyBillId)).toEqual([2]);
        expect(summary?.totalOutstanding).toBe(800);
    });

    test('locates a notification bill without replacing the current cycle', () => {
        const summary = buildBillingSummary([
            bill({ monthlyBillId: 2, billingCycleId: 22, billingMonth: '2026-10-01' }),
            bill({ monthlyBillId: 1, billingCycleId: 11, billingMonth: '2026-09-01', isArrears: true }),
        ], { billingCycleId: 11 });
        expect(summary?.currentBill.monthlyBillId).toBe(2);
        expect(summary?.focusedBillId).toBe(1);
    });
});

test('payment history groups allocations by transaction within the scoped bills', () => {
    const payment = (transactionId: number, allocationId: number, amount: number) => ({
        transactionId, allocationId, amount, paymentDate: '2026-10-05', referenceNumber: 'OR-1',
        notes: null, recordedByStaffId: 1, recordedBy: 'Staff', recordedAt: '2026-10-05T10:00:00',
    });
    const history = buildPaymentHistory([
        bill({ paymentHistory: [payment(7, 1, 300)] }),
        bill({ monthlyBillId: 2, paymentHistory: [payment(7, 2, 200), payment(8, 3, 100)] }),
    ]);
    expect(history).toEqual([
        expect.objectContaining({ paymentId: 8, amount: 100 }),
        expect.objectContaining({ paymentId: 7, amount: 500 }),
    ]);
});
