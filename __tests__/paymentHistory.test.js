import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import PaymentHistoryRoute from '../src/app/payment-history';
import { fetchPaymentHistory } from '../src/lib/billing';

jest.mock('expo-router', () => ({
    useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => {
    const ReactModule = require('react');
    return { Ionicons: (props) => ReactModule.createElement('Ionicons', props) };
});

jest.mock('react-native-safe-area-context', () => {
    const ReactModule = require('react');
    return { SafeAreaView: ({ children }) => ReactModule.createElement('SafeAreaView', null, children) };
});

jest.mock('../src/lib/billing', () => ({ fetchPaymentHistory: jest.fn() }));
jest.mock('../src/lib/authSession', () => ({
    useAuthSession: () => ({ currentUser: { businessId: 401 } }),
}));
jest.mock('../src/lib/theme', () => ({
    useThemedStyles: (styles) => styles,
    useTheme: () => ({
        colors: {
            icon: '#000000', primary: '#0000ff', success: '#008000', textMuted: '#666666',
        },
    }),
}));

const textContent = (node) => {
    const children = node?.props?.children;
    if (typeof children === 'string') return children;
    if (Array.isArray(children)) return children.map((child) => (
        typeof child === 'string' ? child : textContent(child)
    )).join('');
    return children && typeof children === 'object' ? textContent(children) : '';
};

const hasText = (root, value) => root.findAll((node) => textContent(node) === value).length > 0;

describe('payment history details', () => {
    beforeAll(() => {
        global.IS_REACT_ACT_ENVIRONMENT = true;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        fetchPaymentHistory.mockResolvedValue([{
            paymentId: 7,
            amount: 500,
            paidAt: '2026-10-05',
            referenceNumber: 'OR-1',
            notes: 'Paid at the cashier',
            recordedBy: 'Staff Member',
            recordedAt: '2026-10-05T10:00:00',
            allocations: [{
                allocationId: 1,
                monthlyBillId: 10,
                billingMonth: '2026-10-01',
                utilityType: 'electricity',
                amount: 400,
            }, {
                allocationId: 2,
                monthlyBillId: 10,
                billingMonth: '2026-10-01',
                utilityType: 'other',
                amount: 100,
            }],
        }]);
    });

    test('expands a payment to show recorder, notes, and utility allocation', async () => {
        let renderer;
        await act(async () => {
            renderer = TestRenderer.create(React.createElement(PaymentHistoryRoute));
        });

        const root = renderer.root;
        expect(hasText(root, 'Staff Member')).toBe(false);
        const paymentButton = root.find((node) => (
            typeof node.props.accessibilityLabel === 'string'
            && node.props.accessibilityLabel.startsWith('Payment ')
        ));

        act(() => paymentButton.props.onPress());

        expect(hasText(root, 'Staff Member')).toBe(true);
        expect(hasText(root, 'Paid at the cashier')).toBe(true);
        expect(hasText(root, 'October 2026')).toBe(true);
        expect(hasText(root, 'Electricity')).toBe(true);
        expect(hasText(root, 'Market Fees')).toBe(true);
    });

    test('uses safe fallbacks when optional payment metadata is absent', async () => {
        fetchPaymentHistory.mockResolvedValueOnce([{
            paymentId: 8,
            amount: 100,
            paidAt: null,
            referenceNumber: null,
            notes: null,
            recordedBy: null,
            recordedAt: null,
            allocations: [{
                allocationId: 2,
                monthlyBillId: 11,
                billingMonth: '2026-09-01',
                utilityType: null,
                amount: 100,
            }],
        }]);
        let renderer;
        await act(async () => {
            renderer = TestRenderer.create(React.createElement(PaymentHistoryRoute));
        });
        const root = renderer.root;
        const paymentButton = root.find((node) => (
            typeof node.props.accessibilityLabel === 'string'
            && node.props.accessibilityLabel.startsWith('Payment ')
        ));

        act(() => paymentButton.props.onPress());

        expect(hasText(root, 'Not available')).toBe(true);
        expect(hasText(root, 'Unspecified')).toBe(true);
    });
});
