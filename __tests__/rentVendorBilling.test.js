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
jest.mock('../src/lib/billing', () => ({
    fetchBillingSummary: jest.fn(),
    calculateUtilityPenalty: jest.fn((bill, _asOfDate, utilityType) => {
        const utilityAmounts = {
            rent: bill.rentAmount,
            water: bill.waterAmount,
            electricity: bill.electricityAmount,
        };
        const originalUtilityAmount = utilityType
            ? utilityAmounts[utilityType]
            : bill.rentAmount + bill.waterAmount + bill.electricityAmount;
        const unpaidPrincipal = utilityType
            ? originalUtilityAmount
            : Math.max(originalUtilityAmount - bill.appliedAmount, 0);
        return {
            originalUtilityAmount,
            unpaidPrincipal,
            surcharge: 0,
            interest: 0,
            additional36MonthCharge: 0,
            totalUtilityBalance: unpaidPrincipal,
            interestMonths: 0,
            totalPenalty: 0,
        };
    }),
}));
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
                    { id: 1, code: 'rent', label: 'Rent', amount: 1000, description: 'October stall rent', utilityType: 'rent' },
                    { id: 2, code: 'electricity', label: 'Electricity', amount: 300, description: null, utilityType: 'electricity' },
                    { id: 3, code: 'water', label: 'Water', amount: 200, description: null, utilityType: 'water' },
                ],
                paymentHistory: [],
            },
            arrearsBills: [{
                monthlyBillId: 2,
                billingCycleId: 9,
                businessOwnerId: 301,
                businessId: 401,
                stallNumber: 'A-1',
                billingMonth: '2026-09-01',
                dueDate: '2026-09-15',
                ownerName: 'Owner User',
                businessName: 'Market Stall',
                issuedAt: '2026-09-01T08:00:00Z',
                totalAmount: 650,
                rentAmount: 0,
                electricityAmount: 0,
                waterAmount: 0,
                otherAmount: 650,
                appliedAmount: 0,
                balance: 650,
                status: 'overdue',
                isArrears: true,
                chargeBreakdown: [
                    { id: 4, code: 'market_fee', label: 'Certification Fee', amount: 150, description: null, utilityType: 'electricity' },
                    { id: 5, code: 'market_fee', label: 'Goodwill Money', amount: 500, description: null, utilityType: 'rent' },
                ],
                paymentHistory: [],
            }],
            arrearsAmount: 650,
            totalOutstanding: 1650,
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
        expect(hasText(root, 'Total Outstanding')).toBe(true);
        expect(hasText(root, 'Utilities')).toBe(true);
        expect(hasText(root, 'Rent')).toBe(true);
        expect(hasText(root, 'Water')).toBe(true);
        expect(hasText(root, 'Electricity')).toBe(true);
        expect(hasText(root, 'Rent Charge Calculation')).toBe(false);
        expect(hasText(root, 'Water Charge Calculation')).toBe(false);
        expect(hasText(root, 'Electricity Charge Calculation')).toBe(false);

        const rentButton = root.findByProps({ accessibilityLabel: 'Rent charge details' });
        const waterButton = root.findByProps({ accessibilityLabel: 'Water charge details' });
        act(() => rentButton.props.onPress());

        expect(hasText(root, 'Rent Charge Calculation')).toBe(true);
        expect(hasText(root, 'Water Charge Calculation')).toBe(false);
        expect(hasText(root, 'Unpaid principal')).toBe(true);
        expect(hasText(root, 'One-time 25% surcharge')).toBe(true);
        expect(hasText(root, 'Interest (2% per month starting when overdue, maximum 36 charges)')).toBe(true);
        expect(hasText(root, '36-month additional charge (72%)')).toBe(true);
        expect(hasText(root, 'Total rent balance')).toBe(true);

        act(() => waterButton.props.onPress());
        expect(hasText(root, 'Rent Charge Calculation')).toBe(true);
        expect(hasText(root, 'Water Charge Calculation')).toBe(true);
        expect(hasText(root, 'Total water balance')).toBe(true);
        expect(hasText(root, 'October stall rent')).toBe(false);
        expect(hasText(root, 'Market Fees')).toBe(true);
        expect(hasText(root, 'Certification Fee')).toBe(false);
        expect(hasText(root, 'Goodwill Money')).toBe(false);
        expect(hasText(root, 'P 650.00 billed')).toBe(true);
        expect(hasText(root, 'Add Personnel')).toBe(false);
        expect(hasText(root, 'LEASE AGREEMENT')).toBe(false);
    });
});
