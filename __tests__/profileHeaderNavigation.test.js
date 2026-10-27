import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import POSHeader from '../src/components/pos/components/POSHeader';
import Home from '../src/components/home/Home';

const mockPush = jest.fn();
const currentUser = {
    accountId: 1,
    phoneNumber: '+639171234567',
    email: null,
    userType: 'business_owner',
    displayName: 'Howard A Stark',
    profileTable: 'business_owner',
    profileId: 2,
    businessOwnerId: 2,
    businessId: 3,
    businessName: 'Stark Industries',
    stallId: '2-073',
    stallNumber: '2-073',
    profilePictureUrl: null,
};

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@expo/vector-icons', () => {
    const ReactModule = require('react');
    return {
        Ionicons: (props) => ReactModule.createElement('Ionicons', props),
        MaterialCommunityIcons: (props) => ReactModule.createElement('MaterialCommunityIcons', props),
    };
});
jest.mock('react-native-safe-area-context', () => {
    const ReactModule = require('react');
    return { SafeAreaView: ({ children }) => ReactModule.createElement('SafeAreaView', null, children) };
});
jest.mock('../src/lib/authSession', () => ({ useAuthSession: () => ({ currentUser }) }));
jest.mock('../src/lib/useUnreadNotificationCount', () => ({
    useUnreadNotificationCount: () => ({ unreadNotificationCount: 0 }),
}));
jest.mock('../src/lib/theme', () => ({
    useThemedStyles: (styles) => styles,
    useTheme: () => ({
        colors: {
            icon: '#000', textMuted: '#777', primary: '#00f', success: '#080', danger: '#f00',
        },
    }),
}));
jest.mock('../src/lib/businessOperatingStatus', () => ({
    useBusinessOperatingStatus: () => ({
        isOpen: true, isLoading: false, isUpdating: false, error: null, canToggle: true, setIsOpen: jest.fn(),
    }),
}));
jest.mock('../src/components/pos/transactionsStore', () => ({ loadSavedTransactions: jest.fn() }));
jest.mock('../src/lib/transactionsSync', () => ({
    loadRemoteSalesTransactions: jest.fn(), mergeLocalAndRemoteTransactions: jest.fn(),
}));
jest.mock('../src/lib/transactionSyncEvents', () => ({ subscribeToTransactionSyncEvents: jest.fn() }));
jest.mock('../src/components/home/homeSalesStore', () => ({
    loadHomeSalesCache: jest.fn(), saveHomeSalesCache: jest.fn(),
}));

describe('profile header navigation', () => {
    beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
    beforeEach(() => { jest.clearAllMocks(); });

    test.each([
        ['shared header', POSHeader],
        ['home header', Home],
    ])('opens Profile from the %s identity area', async (_label, Component) => {
        let renderer;
        await act(async () => { renderer = TestRenderer.create(<Component />); });
        const profileButton = renderer.root.findByProps({ accessibilityLabel: 'Open profile' });

        act(() => { profileButton.props.onPress(); });

        expect(mockPush).toHaveBeenCalledWith('/profile');
    });
});
