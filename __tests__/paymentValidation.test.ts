import { calculatePaymentChange } from '../src/components/pos/paymentValidation';

describe('payment change validation', () => {
    test.each([
        ['nothing has been entered', 100, 0],
        ['payment is below the total', 100, 99.99],
        ['the total is invalid', 0, 100],
        ['the payment is not finite', 100, Number.NaN],
    ])('is invalid when %s', (_reason, totalDue, paidAmount) => {
        expect(calculatePaymentChange(totalDue, paidAmount)).toEqual({
            isValid: false,
            changeAmount: 0,
        });
    });

    test('becomes valid with zero change for exact payment', () => {
        expect(calculatePaymentChange(100, 100)).toEqual({
            isValid: true,
            changeAmount: 0,
        });
    });

    test('returns the actual change when payment exceeds the total', () => {
        expect(calculatePaymentChange(100, 150)).toEqual({
            isValid: true,
            changeAmount: 50,
        });
    });
});
