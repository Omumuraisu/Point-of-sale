const mockRpc = jest.fn();
const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockGetExpoPushToken = jest.fn();
const mockSetChannel = jest.fn();
const mockDismissAll = jest.fn();
const mockStorage = new Map<string, string>();

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({
    expoConfig: { extra: { eas: { projectId: 'project-1' } } },
    easConfig: null,
}));
jest.mock('expo-notifications', () => ({
    AndroidImportance: { HIGH: 4 },
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: (...args: unknown[]) => mockSetChannel(...args),
    getPermissionsAsync: () => mockGetPermissions(),
    requestPermissionsAsync: () => mockRequestPermissions(),
    getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushToken(...args),
    dismissAllNotificationsAsync: () => mockDismissAll(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: (key: string) => Promise.resolve(mockStorage.get(key) ?? null),
    setItem: (key: string, value: string) => { mockStorage.set(key, value); return Promise.resolve(); },
    removeItem: (key: string) => { mockStorage.delete(key); return Promise.resolve(); },
}));
jest.mock('../src/lib/supabase', () => ({
    isSupabaseConfigured: true,
    supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock('../src/lib/debugLogging', () => ({
    debugLog: jest.fn(),
    debugWarn: jest.fn(),
    debugError: jest.fn(),
}));

import {
    getPushNotificationDestination,
    registerCurrentDeviceForPush,
    unregisterCurrentDevicePushToken,
} from '../src/lib/pushNotifications';

describe('Android push notification registration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStorage.clear();
        mockGetPermissions.mockResolvedValue({ status: 'granted' });
        mockRequestPermissions.mockResolvedValue({ status: 'granted' });
        mockGetExpoPushToken.mockResolvedValue({ data: 'ExponentPushToken[test-device-token]' });
        mockRpc.mockResolvedValue({ data: 1, error: null });
    });

    test('creates the Android channel and registers the Expo token for the authenticated account', async () => {
        await expect(registerCurrentDeviceForPush()).resolves.toBe('registered');

        expect(mockSetChannel).toHaveBeenCalledWith('pos-alerts', expect.objectContaining({ importance: 4 }));
        expect(mockGetExpoPushToken).toHaveBeenCalledWith({ projectId: 'project-1' });
        expect(mockRpc).toHaveBeenCalledWith('register_pos_push_token', {
            p_expo_push_token: 'ExponentPushToken[test-device-token]',
            p_platform: 'android',
        });
    });

    test('does not request a token when notification permission is denied', async () => {
        mockGetPermissions.mockResolvedValue({ status: 'undetermined' });
        mockRequestPermissions.mockResolvedValue({ status: 'denied' });

        await expect(registerCurrentDeviceForPush()).resolves.toBe('permission_denied');
        expect(mockGetExpoPushToken).not.toHaveBeenCalled();
        expect(mockRpc).not.toHaveBeenCalled();
    });

    test('surfaces backend registration failures for a later retry', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
        await expect(registerCurrentDeviceForPush()).resolves.toBe('registration_failed');
    });

    test('unregisters the stored device token before logout', async () => {
        await registerCurrentDeviceForPush();
        mockRpc.mockClear();

        await expect(unregisterCurrentDevicePushToken()).resolves.toBe(true);
        expect(mockRpc).toHaveBeenCalledWith('unregister_pos_push_token', {
            p_expo_push_token: 'ExponentPushToken[test-device-token]',
        });
        expect(mockDismissAll).toHaveBeenCalled();
    });
});

describe('push notification navigation', () => {
    test('routes billing pushes to the focused bill', () => {
        expect(getPushNotificationDestination({
            notificationType: 'billing_overdue',
            billingCycleId: 42,
            billingMonth: '2026-10-01',
        })).toEqual({
            pathname: '/rent',
            params: { billingCycleId: '42', billingMonth: '2026-10-01' },
        });
    });

    test('routes non-billing pushes to the notification list', () => {
        expect(getPushNotificationDestination({ notificationType: 'vendor_compliance_requested' }))
            .toEqual({ pathname: '/notifications' });
    });
});
