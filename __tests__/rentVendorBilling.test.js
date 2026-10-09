import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import Rent from '../src/components/rent/Rent';
import { fetchBillingSummary } from '../src/lib/billing';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush }),
    useLocalSearchParams: () => ({}),
    useFocusEffect: (callback) => {
        const ReactModule = require('react');
        ReactModule.useEffect(callback, [callback]);
    },
}));

jest.mock('@expo/vector-icons', () => {
    const ReactModule = require('react');
    return {
        Ionicons: (props) => ReactModule.createElement('Ionicons', props),
        MaterialCommunityIcons: (props) => ReactModule.createElement('MaterialCommunityIcons', props),
    };
});

jest.mock('react-native-safe-area-context', () => {
    const ReactModule = require('react');
    return {
        SafeAreaView: ({ children }) => ReactModule.createElement('SafeAreaView', null, children),
    };
});

jest.mock('../src/components/pos/components/POSHeader', () => () => null);
jest.mock('../src/components/rent/personnelStore', () => ({ loadVendorApplications: jest.fn().mockResolvedValue([]) }));
jest.mock('../src/lib/businessLease', () => ({ fetchBusinessLeaseAgreement: jest.fn() }));
jest.mock('../src/lib/billing', () => ({ fetchBillingSummary: jest.fn() }));
jest.mock('../src/lib/authSession', () => ({
    useAuthSession: () => ({
        currentUser: {
            accountId: 101,
            phoneNumber: '+639171234567',
            userType: 'vendor',
            displayName: 'Vendor User',
            profileTable: 'vendor',
            profileId: 201,
            businessOwnerId: 301,
            businessId: 401,
            businessName: 'Market Stall',
            stallId: 'A-1',
            stallNumber: 'A-1',
            profilePictureUrl: null,
        },
    }),
}));
jest.mock('../src/lib/theme', () => ({
    useThemedStyles: (styles) => styles,
    useTheme: () => ({
        colors: {
            icon: '#000000',
            primary: '#0000ff',
            success: '#008000',
            danger: '#ff0000',
            textMuted: '#666666',
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

describe('vendor billing visibility', () => {
    beforeAll(() => {
        global.IS_REACT_ACT_ENVIRONMENT = true;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        fetchBillingSummary.mockResolvedValue({
            currentBill: {
                monthlyBillId: 1,
                billingCycleId: 10,
                businessOwnerId: 301,
                businessId: 401,
                stallNumber: 'A-1',
                billingMonth: '2026-10-01',
                dueDate: '2026-10-15',
                ownerName: 'Owner User',
                businessName: 'Market Stall',
                issuedAt: '2026-10-01T08:00:00Z',
                totalAmount: 1500,
                rentAmount: 1000,
                electricityAmount: 300,
                waterAmount: 200,
                otherAmount: 0,
                appliedAmount: 500,
                balance: 1000,
                status: 'partially_paid',
                isArrears: false,
                chargeBreakdown: [
                    { id: 1, code: 'rent', label: 'Rent', amount: 1000, description: null },
                    { id: 2, code: 'electricity', label: 'Electricity', amount: 300, description: null },
                    { id: 3, code: 'water', label: 'Water', amount: 200, description: null },
                ],
                paymentHistory: [],
            },
            arrearsBills: [],
            arrearsAmount: 0,
            totalOutstanding: 1000,
            focusedBillId: null,
        });
    });

    test('shows the billing month and lets a vendor expand the read-only bill summary', async () => {
        let renderer;
        await act(async () => {
            renderer = TestRenderer.create(React.createElement(Rent));
        });

        const root = renderer.root;
        expect(hasText(root, 'October 2026 Bill')).toBe(true);
        expect(hasText(root, 'Payment History')).toBe(true);
        expect(hasText(root, 'Bill Summary')).toBe(false);

        const dueText = root.findAllByType(Text).find((node) => (
            node.props.children === 'Due: October 15, 2026'
        ));
        let dueRow = dueText?.parent;
        while (dueRow && typeof dueRow.props.onPress !== 'function') dueRow = dueRow.parent;
        expect(dueRow).not.toBeNull();

        act(() => dueRow.props.onPress());

        expect(hasText(root, 'Bill Summary')).toBe(true);
        expect(hasText(root, 'Payments Applied')).toBe(true);
        expect(hasText(root, 'Current Balance')).toBe(true);
        expect(hasText(root, 'Add Personnel')).toBe(false);
        expect(hasText(root, 'LEASE AGREEMENT')).toBe(false);
    });
});
