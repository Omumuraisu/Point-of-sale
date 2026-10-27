import React from 'react';
import { Alert, Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import Profile from '../src/app/(tabs)/profile';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockRpc = jest.fn();
const mockUpdateCurrentUser = jest.fn();
let mockCurrentUser;

jest.mock('expo-router', () => ({
    useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));

jest.mock('expo-image-picker', () => ({
    MediaTypeOptions: { Images: 'Images' },
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => {
    const ReactModule = require('react');
    return { Ionicons: (props) => ReactModule.createElement('Ionicons', props) };
});

jest.mock('react-native-safe-area-context', () => {
    const ReactModule = require('react');
    return { SafeAreaView: ({ children }) => ReactModule.createElement('SafeAreaView', null, children) };
});

jest.mock('../src/lib/supabase', () => ({
    isSupabaseConfigured: true,
    supabase: {
        rpc: (...args) => mockRpc(...args),
        storage: {
            from: () => ({
                upload: jest.fn(),
                remove: jest.fn(),
                getPublicUrl: jest.fn(),
            }),
        },
    },
}));

jest.mock('../src/lib/authSession', () => ({
    useAuthSession: () => ({
        session: { user: { id: 'auth-user' } },
        currentUser: mockCurrentUser,
        updateCurrentUser: mockUpdateCurrentUser,
    }),
}));

jest.mock('../src/lib/theme', () => ({
    useThemedStyles: (styles) => styles,
    useTheme: () => ({
        colors: {
            icon: '#000', textSecondary: '#555', textMuted: '#777',
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

const owner = (overrides = {}) => ({
    accountId: 1,
    phoneNumber: '+639171234567',
    email: 'owner@example.com',
    userType: 'business_owner',
    displayName: 'Howard A Stark',
    profileTable: 'business_owner',
    profileId: 2,
    businessOwnerId: 2,
    businessId: 3,
    businessName: 'Stark Industries',
    stallId: '2-073',
    stallNumber: '2-073',
    profilePictureUrl: 'https://example.com/avatar.jpg',
    ...overrides,
});

describe('profile account details', () => {
    beforeAll(() => {
        global.IS_REACT_ACT_ENVIRONMENT = true;
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockCurrentUser = owner();
        mockRpc.mockResolvedValue({ error: null });
        mockUpdateCurrentUser.mockResolvedValue(undefined);
    });

    test('shows read-only identity details and optional email', async () => {
        let renderer;
        await act(async () => { renderer = TestRenderer.create(<Profile />); });
        const root = renderer.root;

        expect(hasText(root, 'Howard A Stark')).toBe(true);
        expect(hasText(root, 'STALL OWNER')).toBe(true);
        expect(hasText(root, 'owner@example.com')).toBe(true);
        expect(hasText(root, 'Stark Industries')).toBe(true);
        expect(hasText(root, '+639171234567')).toBe(true);
        expect(hasText(root, 'Change Name')).toBe(false);
        expect(root.findAllByType(TextInput)).toHaveLength(0);
        expect(hasText(root, 'Save Picture')).toBe(true);
    });

    test('omits email when the account has none', async () => {
        mockCurrentUser = owner({ email: null });
        let renderer;
        await act(async () => { renderer = TestRenderer.create(<Profile />); });

        expect(hasText(renderer.root, 'Email')).toBe(false);
    });

    test('shows developers a read-only profile', async () => {
        mockCurrentUser = owner({
            profileTable: 'developer', userType: 'developer', displayName: 'Dev User',
        });
        let renderer;
        await act(async () => { renderer = TestRenderer.create(<Profile />); });
        const root = renderer.root;

        expect(hasText(root, 'DEVELOPER')).toBe(true);
        expect(hasText(root, 'Profile Picture')).toBe(true);
        expect(hasText(root, 'Upload Photo')).toBe(false);
        expect(hasText(root, 'Replace Photo')).toBe(false);
        expect(hasText(root, 'Save Picture')).toBe(false);
        expect(mockReplace).not.toHaveBeenCalled();
    });

    test('saves the picture through the photo-only RPC without name fields', async () => {
        let renderer;
        await act(async () => { renderer = TestRenderer.create(<Profile />); });
        const saveText = renderer.root.findAllByType(Text).find((node) => textContent(node) === 'Save Picture');
        let saveButton = saveText?.parent;
        while (saveButton && typeof saveButton.props.onPress !== 'function') saveButton = saveButton.parent;

        await act(async () => { await saveButton.props.onPress(); });

        expect(mockRpc).toHaveBeenCalledWith('update_my_pos_profile_photo', {
            p_profile_picture_url: 'https://example.com/avatar.jpg',
        });
        expect(mockRpc.mock.calls[0][1]).not.toHaveProperty('p_first_name');
        expect(mockRpc.mock.calls[0][1]).not.toHaveProperty('p_last_name');
        expect(mockUpdateCurrentUser).toHaveBeenCalledWith({
            profilePictureUrl: 'https://example.com/avatar.jpg',
        });
    });
});
