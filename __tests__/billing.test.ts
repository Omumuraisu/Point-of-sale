const mockRpc = jest.fn();

jest.mock('../src/lib/supabase', () => ({
    isSupabaseConfigured: true,
    supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock('../src/lib/debugLogging', () => ({ debugError: jest.fn() }));

import {
    buildBillingSummary,
    buildPaymentHistory,
    calculateUtilityPenalty,
    fetchBillingSummary,
    mapMonthlyBillRow,
    MonthlyBillBalance,
} from '../src/lib/billing';

beforeEach(() => {
    mockRpc.mockReset();
});

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
    charge_breakdown: [{
        id: 1, code: 'rent', label: 'Rent', amount: '1000', description: 'Monthly stall rent', utilityType: 'rent',
    }],
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
            expect.objectContaining({
                code: 'rent', label: 'Rent', amount: 1000, description: 'Monthly stall rent', utilityType: 'rent',
            }),
        ]);
    });

    test('keeps pre-migration billing JSON compatible when utility types are absent', () => {
        const mapped = mapMonthlyBillRow(row({
            charge_breakdown: [{ id: 1, code: 'rent', label: 'Rent', amount: 1000, description: null }],
            payment_history: [{
                transactionId: 7, allocationId: 1, amount: 100, paymentDate: '2026-10-05',
                referenceNumber: 'OR-1', notes: null, recordedByStaffId: 1,
                recordedBy: 'Staff', recordedAt: '2026-10-05T10:00:00',
            }],
        }) as never);

        expect(mapped.chargeBreakdown[0].utilityType).toBeNull();
        expect(mapped.paymentHistory[0].utilityType).toBeNull();
    });

    test('safely ignores malformed JSON arrays', () => {
        const mapped = mapMonthlyBillRow(row({ charge_breakdown: '{bad', payment_history: {} }) as never);
        expect(mapped.chargeBreakdown).toEqual([]);
        expect(mapped.paymentHistory).toEqual([]);
    });
});

describe('utility overdue charges', () => {
    test('uses the original utility total for the surcharge and monthly interest', () => {
        const mapped = mapMonthlyBillRow(row({ due_date: '2026-10-15' }) as never);

        expect(calculateUtilityPenalty(mapped, '2026-10-16')).toEqual({
            originalUtilityAmount: 1500,
            unpaidPrincipal: 1000,
            surcharge: 375,
            interest: 30,
            additional36MonthCharge: 0,
            totalUtilityBalance: 1405,
            interestMonths: 1,
            totalPenalty: 405,
        });
    });

    test('caps interest at 36 charges and then adds the separate 72% charge', () => {
        const mapped = mapMonthlyBillRow(row({ due_date: '2023-10-15', applied_amount: 0 }) as never);
        const result = calculateUtilityPenalty(mapped, '2026-10-16');

        expect(result.interestMonths).toBe(36);
        expect(result.surcharge).toBe(375);
        expect(result.interest).toBe(1080);
        expect(result.additional36MonthCharge).toBe(1080);
        expect(result.totalUtilityBalance).toBe(4035);
    });

    test('does not add overdue charges before the due date or after full payment', () => {
        const pending = mapMonthlyBillRow(row({ due_date: '2026-10-15', status: 'pending' }) as never);
        const paid = mapMonthlyBillRow(row({ due_date: '2026-01-15', status: 'fully_paid', applied_amount: 1500 }) as never);

        expect(calculateUtilityPenalty(pending, '2026-10-15').totalPenalty).toBe(0);
        expect(calculateUtilityPenalty(paid, '2026-10-16').totalPenalty).toBe(0);
    });

    test('uses typed utility allocations when determining unpaid principal', () => {
        const mapped = mapMonthlyBillRow(row({
            due_date: '2026-10-15',
            applied_amount: 500,
            status: 'fully_paid',
            payment_history: [{
                transactionId: 1, allocationId: 1, amount: 100, paymentDate: '2026-10-16',
                referenceNumber: 'OR-1', notes: null, recordedByStaffId: 1,
                recordedBy: 'Staff', recordedAt: '2026-10-16T10:00:00', utilityType: 'water',
            }, {
                transactionId: 1, allocationId: 2, amount: 400, paymentDate: '2026-10-16',
                referenceNumber: 'OR-1', notes: null, recordedByStaffId: 1,
                recordedBy: 'Staff', recordedAt: '2026-10-16T10:00:00', utilityType: 'other',
            }],
        }) as never);

        expect(calculateUtilityPenalty(mapped, '2026-10-16').unpaidPrincipal).toBe(1400);
        expect(calculateUtilityPenalty(mapped, '2026-10-16', 'water').unpaidPrincipal).toBe(100);
        expect(calculateUtilityPenalty(mapped, '2026-10-16', 'electricity').unpaidPrincipal).toBe(300);
        expect(calculateUtilityPenalty(mapped, '2026-10-16', 'water').surcharge).toBe(50);
        expect(calculateUtilityPenalty(mapped, '2026-10-16', 'water').interest).toBe(4);
    });

    test('proportionally assigns untyped bill payments when showing individual utilities', () => {
        const mapped = mapMonthlyBillRow(row({ due_date: '2026-10-15' }) as never);

        expect(calculateUtilityPenalty(mapped, '2026-10-16', 'rent').unpaidPrincipal).toBe(666.67);
        expect(calculateUtilityPenalty(mapped, '2026-10-16', 'water').unpaidPrincipal).toBe(133.33);
        expect(calculateUtilityPenalty(mapped, '2026-10-16', 'electricity').unpaidPrincipal).toBe(200);
    });

    test('keeps rent overdue charges when the overall bill is marked fully paid', () => {
        const mapped = mapMonthlyBillRow(row({
            due_date: '2026-09-30',
            status: 'fully_paid',
            rent_amount: 1500,
            electricity_amount: 0,
            water_amount: 0,
            payment_history: [{
                transactionId: 1, allocationId: 1, amount: 1160.97, paymentDate: '2026-10-01',
                referenceNumber: 'OR-1', notes: null, recordedByStaffId: 1,
                recordedBy: 'Staff', recordedAt: '2026-10-01T10:00:00', utilityType: 'rent',
            }],
        }) as never);

        expect(calculateUtilityPenalty(mapped, '2026-10-26', 'rent')).toEqual(expect.objectContaining({
            unpaidPrincipal: 339.03,
            surcharge: 375,
            interest: 30,
            additional36MonthCharge: 0,
            totalUtilityBalance: 744.03,
        }));
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

test('payment history groups allocations by transaction and preserves their details', () => {
    const payment = (transactionId: number, allocationId: number, amount: number, utilityType: 'rent' | 'water') => ({
        transactionId, allocationId, amount, paymentDate: '2026-10-05', referenceNumber: 'OR-1',
        notes: 'Counter payment', recordedByStaffId: 1, recordedBy: 'Staff Member',
        recordedAt: '2026-10-05T10:00:00', utilityType,
    });
    const history = buildPaymentHistory([
        bill({ billingMonth: '2026-10-01', paymentHistory: [payment(7, 1, 300, 'rent')] }),
        bill({
            monthlyBillId: 2,
            billingMonth: '2026-09-01',
            paymentHistory: [payment(7, 2, 200, 'water'), payment(8, 3, 100, 'rent')],
        }),
    ]);
    expect(history).toEqual([
        expect.objectContaining({ paymentId: 8, amount: 100 }),
        expect.objectContaining({
            paymentId: 7,
            amount: 500,
            notes: 'Counter payment',
            recordedBy: 'Staff Member',
            recordedAt: '2026-10-05T10:00:00',
            allocations: [
                expect.objectContaining({
                    allocationId: 1, billingMonth: '2026-10-01', utilityType: 'rent', amount: 300,
                }),
                expect.objectContaining({
                    allocationId: 2, billingMonth: '2026-09-01', utilityType: 'water', amount: 200,
                }),
            ],
        }),
    ]);
});

describe('authenticated billing RPC', () => {
    test('loads bill balances using only the active business id', async () => {
        mockRpc.mockResolvedValue({ data: [row()], error: null });

        const summary = await fetchBillingSummary({ businessId: 30 });

        expect(mockRpc).toHaveBeenCalledWith('get_pos_billing_balances', { p_business_id: 30 });
        expect(summary?.currentBill.monthlyBillId).toBe(1);
        expect(summary?.currentBill.balance).toBe(1000);
    });

    test('does not query Supabase without an active business', async () => {
        await expect(fetchBillingSummary({ businessId: null })).resolves.toBeNull();
        expect(mockRpc).not.toHaveBeenCalled();
    });

    test('surfaces RPC failures instead of treating them as an empty bill list', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

        await expect(fetchBillingSummary({ businessId: 30 })).rejects.toEqual({ message: 'permission denied' });
    });
});
