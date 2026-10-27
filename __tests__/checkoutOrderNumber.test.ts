import fs from 'fs';
import path from 'path';

import { formatCheckoutOrderNumber } from '../src/lib/utils';

describe('checkout order numbers', () => {
    test('creates a stable compact order number from the checkout preparation time', () => {
        const preparedAt = 1_798_000_123_456;

        expect(formatCheckoutOrderNumber(preparedAt)).toMatch(/^#[0-9A-Z]+$/);
        expect(formatCheckoutOrderNumber(preparedAt)).toBe(formatCheckoutOrderNumber(preparedAt));
        expect(formatCheckoutOrderNumber(preparedAt + 1)).not.toBe(formatCheckoutOrderNumber(preparedAt));
    });

    test('does not invent an order number for an invalid preparation time', () => {
        expect(formatCheckoutOrderNumber(0)).toBe('#UNAVAILABLE');
        expect(formatCheckoutOrderNumber(Number.NaN)).toBe('#UNAVAILABLE');
    });

    test('receipt and payment screens show the generated number instead of Pending', () => {
        for (const relativePath of [
            'src/components/pos/Receipt.tsx',
            'src/components/pos/Payment.tsx',
        ]) {
            const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
            expect(source).toContain('Order No. {formatCheckoutOrderNumber(preparedAt)}');
            expect(source).not.toContain('Order No. Pending');
        }
    });
});
