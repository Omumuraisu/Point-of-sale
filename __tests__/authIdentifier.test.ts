jest.mock('../src/lib/debugLogging', () => ({
    debugLog: jest.fn(),
    debugWarn: jest.fn(),
}));

import {
    buildPasswordCredentials,
    maskEmail,
    maskIdentifier,
    normalizeEmail,
    parseAuthIdentifier,
} from '../src/lib/authFlow';

describe('authentication identifiers', () => {
    test('normalizes and classifies email addresses case-insensitively', () => {
        expect(normalizeEmail('  Vendor@Example.COM ')).toBe('vendor@example.com');
        expect(parseAuthIdentifier(' Vendor@Example.COM ')).toEqual({
            value: 'vendor@example.com',
            channel: 'email',
        });
    });

    test.each([
        ['09171234567', '+639171234567'],
        ['9171234567', '+639171234567'],
        ['+63 917 123 4567', '+639171234567'],
    ])('classifies Philippine phone input %s', (input, expected) => {
        expect(parseAuthIdentifier(input)).toEqual({ value: expected, channel: 'sms' });
    });

    test.each(['', 'not-an-email', '12345', 'person@localhost'])('rejects invalid identifier %s', (input) => {
        expect(parseAuthIdentifier(input)).toBeNull();
    });

    test('masks email and channel-specific identifiers', () => {
        expect(maskEmail('vendor@example.com')).toBe('ve****@example.com');
        expect(maskIdentifier('+639171234567', 'sms')).toBe('********4567');
    });

    test('builds the correct Supabase password credentials', () => {
        expect(buildPasswordCredentials('Owner@Example.com', 'Secret@123')).toEqual({
            email: 'owner@example.com',
            password: 'Secret@123',
        });
        expect(buildPasswordCredentials('09171234567', 'Secret@123')).toEqual({
            phone: '+639171234567',
            password: 'Secret@123',
        });
    });
});
