jest.mock('../src/lib/debugLogging', () => ({
    debugLog: jest.fn(),
    debugWarn: jest.fn(),
}));

import { isStrongPassword } from '../src/lib/authFlow';

describe('password strength policy', () => {
    test('accepts a password containing every required character class', () => {
        expect(isStrongPassword('Market@123')).toBe(true);
    });

    test.each([
        ['fewer than eight characters', 'Mar@12'],
        ['no lowercase letter', 'MARKET@123'],
        ['no uppercase letter', 'market@123'],
        ['no number', 'Market@Test'],
        ['no symbol', 'Market123'],
        ['only whitespace instead of a symbol', 'Market 123'],
    ])('rejects a password with %s', (_reason, password) => {
        expect(isStrongPassword(password)).toBe(false);
    });
});
